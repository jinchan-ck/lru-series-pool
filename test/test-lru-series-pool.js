var test = require('tape');

var LsPool = require('../lib/lru-series-pool');

function worker(task, callback) {
  setTimeout(function () {
    callback(task.key + ': ' + task.value);
  }, 2000);
}

function taskCallback(key) {
  console.log('task: %s completed!', key);
}

test('test running and left', function (t) {
  var lsPool = LsPool.generatePool(worker, 5, 5);
  lsPool.push({value: 'task1', key: 'user1'}, taskCallback);
  lsPool.push({value: 'task2', key: 'user2'}, taskCallback);
  lsPool.push({value: 'task3', key: 'user3'}, taskCallback);
  lsPool.push({value: 'task4', key: 'user4'}, taskCallback);
  lsPool.push({value: 'task5', key: 'user5'}, taskCallback);
  lsPool.push({value: 'task6', key: 'user6'}, taskCallback);
  setTimeout(function () {
    t.equal(lsPool.running(), 5, 'running count');
    t.equal(lsPool.left(), 1, 'left task');
  }, 100);
  lsPool.drain = function () {
    t.ok(1, 'lsPool drained');
    t.end();
    lsPool.clean();
  };
});

test('test add to working queue', function (t) {
  var lsPool = LsPool.generatePool(worker, 5, 5);
  lsPool.push({value: 'task1', key: 'user1'}, taskCallback);
  lsPool.push({value: 'task2', key: 'user2'}, taskCallback);
  lsPool.push({value: 'task3', key: 'user3'}, taskCallback);
  lsPool.push({value: 'task4', key: 'user4'}, taskCallback);
  lsPool.push({value: 'task5', key: 'user5'}, taskCallback);
  lsPool.push({value: 'task6', key: 'user5'}, taskCallback);
  lsPool.push({value: 'task7', key: 'user5'}, taskCallback);
  setTimeout(function () {
    t.equal(lsPool.queueLength('user5'), 3, 'working queueLength');
    var workingQueue = lsPool.getQueue('user5') || {tasks: []};
    t.equal(workingQueue.tasks.length, 2, 'left tasks for one working queue');
    var tasks = [];
    workingQueue.tasks.forEach(function (item) {
      tasks.push(item.data);
    });
    t.deepEqual(tasks, [{value: 'task6', key: 'user5'}, {value: 'task7', key: 'user5'}], 'working queue tasks');
  }, 100);
  lsPool.drain = function () {
    t.ok(1, 'lsPool drained');
    t.end();
    lsPool.clean();
  };
});