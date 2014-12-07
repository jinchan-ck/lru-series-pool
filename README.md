Concurrent Queue Manager
========================
###Using Scene
There are numbers of tasks to be handled. The tasks can be divided into serval parts by some special key, and tasks in each part must be handled in series. Meanwhile, tasks in different part can be handled in parallel, but there is a limit of the concurrent tasks.  

This lib can be useful to the scene above. And each task runs with a timeout plus tasks queue cached with [node-lru](https://github.com/sweetvvck/node-lru).

### Usage

```
var lsPoolConfig = {
  "options": {
    "concurrency": 5,
    "timeout": 30000
  },
  "cacheOptions": {
    "capacity": 5,
    "expires": 6000
  }
};
var lsPool = LSPool.generatePool(_handleTask.bind(self),
  lsPoolConfig.options, lsPoolConfig.cacheOptions);
lsPool.extrusion = function (tail) {
  if (!tail || !tail.key) { return; }
  debug('%s was extrusion from lru cache', tail.key);
};
lsPool.expired = function (element) {
  if (!element || !element.key) { return; }
  debug('%s was expired, and was removed from lru cache', element.key);
};
queueManager.listenQueue(queue, function (err, task) {
  if (err) {
    return console.error('[lsitenerQueue callback] ', err, err.stack);
  }
  debug('received task');
  task.key = task.data.user; // task must have an attribute named key
  lsPool.push(task, finished);
});
```

### Run tests
```
$ npm test
```
