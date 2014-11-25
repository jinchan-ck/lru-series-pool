var async = require('async');

var LRU = require('node-lru');

/*
 * wrap function which can only be called once
 */
function only_once(fn) {
  var called = false;
  return function () {
    if (called) { throw new Error("Callback was already called."); }
    called = true;
    fn.apply(exports, arguments);
  };
}

/**
 * generate lru series pool
 * @param  {Function} worker               function that handle task in pool
 * @param  {Integer} concurrency           pool max length
 * @param  {Object||Integer} cacheOptions  capacity and expires
 * @return {Object}                        generated pool
 */
exports.generatePool = function (worker, concurrency, cacheOptions) {
  var count = 0;
  concurrency = concurrency || 1;
  var cache = new LRU(cacheOptions);
  function _insert(pool, data, pos, callback) {
    if (!Array.isArray(data)) {
      data = [data];
    }
    if (data.length + count + pool.waitings.length === 0) {
      // call drain immediately if there are no tasks
      return setImmediate(function () {
        if (pool.drain) {
          pool.drain();
        }
      });
    }
    data.forEach(function (task) {
      var item = {
        data: task,
        callback: typeof callback === 'function' ? callback : null
      };

      if (pos) {
        pool.waitings.unshift(item);
      } else {
        pool.waitings.push(item);
      }

      if (pool.saturated && pool.waitings.length === pool.concurrency) {
        pool.saturated();
      }
      setImmediate(pool.process);
    });
  }

  var pool = {
    waitings: [],
    workings: {},
    drain: null,
    saturated: null,
    cache: cache,
    concurrency: concurrency,
    push: function (data, callback) {
      _insert(pool, data, false, callback);
    },
    unshift: function (data, callback) {
      _insert(pool, data, true, callback);
    },
    process: function () {
      // 1. If no task in waitings, return; else step 2;
      // 2. If there is a queue in working list for the key of the first task,
      //    pick out the task and push it in the working queue;
      //    else step 3;
      // 3. If working queues count greater than or equel to concurrency, return; else step 4;
      // 4. Get(from lru cache) or create a working queue for the task, count ++, push task in it;
      // 5. If a working queue drain, add queue to cache, remove it from working list --count;
      if (pool.waitings && pool.waitings.length) {
        var task = pool.waitings[0];
        var next = function () {
          if (task.callback) {
            task.callback.apply(task, arguments);
          }
          pool.process();
        };
        var cb = only_once(next);
        if (pool.workings[task.data.key]) {
          task = pool.waitings.shift();
          return pool.workings[task.data.key].push(task.data, cb);
        }
        if (count >= concurrency) { return; }
        var workingQueue = pool.cache.get(task.data.key);
        if (!workingQueue) {
          workingQueue = async.queue(worker, 1);
        }
        count += 1;
        task = pool.waitings.shift();
        pool.workings[task.data.key] = workingQueue;
        workingQueue.push(task.data, cb);
        workingQueue.drain = function () {
          pool.cache.set(task.data.key, workingQueue);
          pool.workings[task.data.key] = null;
          count -= 1;
          if (pool.drain && pool.waitings.length + count === 0) {
            pool.drain();
          }
        };
      }
    },
    running: function () {
      return count;
    },
    clean: function () {
      cache.stopCleaner();
      pool.waitings = [];
      pool.workings = {};
      count = 0;
    },
    left: function () {
      return pool.waitings.length;
    },
    queueLength: function (key) {
      var wqueue = pool.workings[key];
      return wqueue ? (wqueue.running() + wqueue.length()) : 0;
    },
    getQueue: function (key) {
      return pool.workings[key];
    }
  };
  cache.on('extrusion', function (tail) {
    if (pool.extrusion && typeof pool.extrusion === 'function') {
      pool.extrusion(tail);
    }
  });
  cache.on('expired', function (element) {
    if (pool.expired && typeof pool.expired === 'function') {
      pool.expired(element);
    }
  });
  return pool;
};