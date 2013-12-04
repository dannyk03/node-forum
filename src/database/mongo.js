

(function(module) {
	'use strict';
	var mongoClient = require('mongodb').MongoClient,
		winston = require('winston'),
		async = require('async'),
		nconf = require('nconf'),
		express = require('express'),
		mongoStore = require('connect-mongo')(express),
		mongoHost = nconf.get('mongo:host'),
		db;

	module.init = function(callback) {
		mongoClient.connect('mongodb://'+ mongoHost + ':' + nconf.get('mongo:port') + '/' + nconf.get('mongo:database'), function(err, _db) {
			db = _db;

			if(err) {
				winston.error("NodeBB could not connect to your Mongo database. Mongo returned the following error: " + err.message);
				process.exit();
			}

			// TODO: fill out settings.db
			module.sessionStore = new mongoStore({
				db: db
			});


			db.createCollection('objects', function(err, _collection) {

			});

			callback(err);
		});

		// look up how its done in mongo
		/*if (nconf.get('mongo:password')) {
			redisClient.auth(nconf.get('mongo:password'));
		}
		*/
	}


	//
	// Exported functions
	//

	module.flushdb = function(callback) {
		db.dropDatabase(function(err, result) {
			if(err){
				winston.error(error);
				return callback(err);
			}
			callback(null);
		});
	}


	module.getFileName = function(callback) {
		throw new Error('not-implemented');
	}

	module.info = function(callback) {
		throw new Error('not-implemented');
	}

	// key

	module.exists = function(key, callback) {
		db.collection('objects').findOne({_key:key}, function(err, item) {
			callback(err, item !== undefined && item !== null);
		});
	}

	module.delete = function(key, callback) {
		db.collection('objects').remove({_key:key}, function(err, result) {
			if(err) {
				if(callback) {
					return callback(err);
				} else {
					return winston.error(err.message);
				}
			}

			if(result === 0) {
				db.collection('objects').remove({setName:key}, function(err, result) {
					if(callback) {
						callback(err, result);
					}
				});
			} else {
				if(callback) {
					callback(null, result);
				}
			}
		});
	}

	module.get = function(key, callback) {
		module.getObjectField(key, 'value', callback);
	}

	module.set = function(key, value, callback) {
		var data = {value:value};
		module.setObject(key, data, callback);
	}

	module.keys = function(key, callback) {
		db.collection('objects').find( { _key: { $regex: key /*, $options: 'i'*/ } }, function(err, result) {
			callback(err, result);
		});
	}

	//hashes
	function removeHiddenFields(item) {
		if(item) {
			if(item._id) {
				delete item._id;
			}
			if(item._key) {
				delete item._key;
			}
			if(item.setName) {
				delete item.setName;
			}
		}
		return item;
	}

	module.setObject = function(key, data, callback) {
		data['_key'] = key;
		db.collection('objects').update({_key:key}, {$set:data}, {upsert:true, w: 1}, function(err, result) {
			if(callback) {
				callback(err, result);
			}
		});
	}

	module.setObjectField = function(key, field, value, callback) {
		var data = {};
		data[field] = value;
		db.collection('objects').update({_key:key}, {$set:data}, {upsert:true, w: 1}, function(err, result) {
			if(callback) {
				callback(err, result);
			}
		});
	}

	module.getObject = function(key, callback) {
		db.collection('objects').findOne({_key:key}, function(err, item) {
			removeHiddenFields(item);

			callback(err, item);
		});
	}

	module.getObjectField = function(key, field, callback) {
		module.getObjectFields(key, [field], function(err, data) {
			if(err) {
				return callback(err);
			}

			callback(null, data[field]);
		});
	}

	module.getObjectFields = function(key, fields, callback) {

		var _fields = {};
		for(var i=0; i<fields.length; ++i) {
			_fields[fields[i]] = 1;
		}

		db.collection('objects').findOne({_key:key}, _fields, function(err, item) {

			if(err) {
				return callback(err);
			}

			if(item === null) {
				item = {};
				for(var i=0; i<fields.length; ++i) {
					item[fields[i]] = null;
				}
			} else {
				for(var i=0; i<fields.length; ++i) {
					if(item[fields[i]] === null || item[fields[i]] === undefined) {
						item[fields[i]] = null;
					}
				}
			}

			removeHiddenFields(item);

			callback(err, item);
		});
	}

	module.getObjectValues = function(key, callback) {
		module.getObject(key, function(err, data) {
			if(err) {
				return callback(err);
			}

			var values = [];
			for(var key in data) {
				values.push(data[key]);
			}
			callback(null, values);
		});
	}

	module.isObjectField = function(key, field, callback) {
		var data = {};
		data[field] = '';
		db.collection('objects').findOne({_key:key}, {fields:data}, function(err, item) {
			if(err) {
				return callback(err);
			}

			callback(err, item && item[field]!== undefined && item[field] !== null);
		});
	}

	module.deleteObjectField = function(key, field, callback) {
		var data = {};
		data[field] = "";
		db.collection('objects').update({_key:key}, {$unset : data}, function(err, result) {
			if(callback) {
				callback(err, result);
			}
		});
	}

	module.incrObjectField = function(key, field, callback) {
		module.incrObjectFieldBy(key, field, 1, callback);
	}

	module.decrObjectField = function(key, field, callback) {
		module.incrObjectFieldBy(key, field, -1, callback);
	}

	module.incrObjectFieldBy = function(key, field, value, callback) {
		var data = {};
		data[field] = value;
		db.collection('objects').update({_key:key}, {$inc : data}, {upsert:true}, function(err, result) {
			module.getObjectField(key, field, function(err, value) {
				if(callback) {
					callback(err, value);
				}
			});
		});
	}


	// sets

	module.setAdd = function(key, value, callback) {

		var data = {
			value:value
		};

		data.setName = key;
		module.setObject(key + ':' + value, data, callback);
	}

	module.setRemove = function(key, value, callback) {
		db.collection('objects').remove({setName:key, value:value}, function(err, result) {
			if(callback) {
				callback(err, result);
			}
		});
	}

	module.isSetMember = function(key, value, callback) {
		db.collection('objects').findOne({setName:key, value:value}, function(err, item) {
			callback(err, item !== null && item !== undefined);
		});
	}

	module.isMemberOfSets = function(sets, value, callback) {


		function iterator(set, next) {
			module.isSetMember(set, value, next);
		}

		async.map(sets, iterator, function(err, result) {
			console.log(err, result);
			callback(err, result);
		});

	}

	module.getSetMembers = function(key, callback) {
		db.collection('objects').find({setName:key}).toArray(function(err, data) {
			if(err) {
				return callback(err);
			}

			if(!data) {
				callback(null, []);
			} else {
				data = data.map(function(item) {
					return item.value;
				});
				callback(null, data);
			}
		});
	}

	module.setCount = function(key, callback) {
		db.collection('objects').count({setName:key}, function(err, count) {
			if(err) {
				return callback(err);
			}

			if(!count) {
				return callback(null, 0);
			}
			callback(null,count);
		});
	}

	module.setRemoveRandom = function(key, callback) {
		db.collection('objects').find({setName:key}).toArray(function(err, data) {
			if(err) {
				if(callback) {
					return callback(err);
				} else {
					return winston.error(err.message);
				}
			}

			if(!data) {
				if(callback) {
					callback(null, 0);
				}
			} else {
				var randomIndex = Math.floor(Math.random() * data.length);
				var item = data[randomIndex];
				module.setRemove(item.setName, item.value, function(err, result) {
					if(callback) {
						callback(err, item.value);
					}
				});
			}
		});
	}


	// sorted sets

	module.sortedSetAdd = function(key, score, value, callback) {

		var data = {
			score:score,
			value:value
		};

		data.setName = key;
		module.setObject(key+':'+value, data, callback);
	}

	module.sortedSetRemove = function(key, value, callback) {
		db.collection('objects').remove({setName:key, value:value}, function(err, result) {
			if(callback) {
				callback(err, result);
			}
		});
	}

	function getSortedSetRange(key, start, stop, sort, callback) {
		db.collection('objects').find({setName:key}, {fields:{value:1}})
			.limit(stop - start + 1)
			.skip(start)
			.sort({score: sort})
			.toArray(function(err, data) {
				if(err) {
					return callback(err);
				}

				// maybe this can be done with mongo?
				data = data.map(function(item) {
					return item.value;
				});

				callback(err, data);
			});
	}

	module.getSortedSetRange = function(key, start, stop, callback) {
		getSortedSetRange(key, start, stop, 1, callback);
	}

	module.getSortedSetRevRange = function(key, start, stop, callback) {
		getSortedSetRange(key, start, stop, -1, callback);
	}

	module.getSortedSetRevRangeByScore = function(args, callback) {

		//var args = ['topics:recent', '+inf', timestamp - since, 'LIMIT', start, end - start + 1];
		var key = args[0],
			max = (args[1] === '+inf')?Number.MAX_VALUE:args[1],
			min = args[2],
			start = args[4],
			stop = args[5];


		db.collection('objects').find({setName:key, score: {$gt:min, $lt:max}}, {fields:{value:1}})
			.limit(stop - start + 1)
			.skip(start)
			.sort({score: -1})
			.toArray(function(err, data) {
				if(err) {
					return callback(err);
				}

				// maybe this can be done with mongo?
				data = data.map(function(item) {
					return item.value;
				});

				callback(err, data);
			});
	}

	module.sortedSetCount = function(key, min, max, callback) {
		db.collection('objects').count({setName:key, score: {$gt:min, $lt:max}}, function(err, count) {
			if(err) {
				return callback(err);
			}

			if(!count) {
				return callback(null, 0);
			}
			callback(null,count);
		});
	}

	// lists
	module.listPrepend = function(key, value, callback) {
		module.isObjectField(key, 'array', function(err, exists) {
			if(err) {
				if(callback) {
					return callback(err);
				} else {
					return winston.error(err.message);
				}
			}

			if(exists) {
 				db.collection('objects').update({_key:key}, {'$set': {'array.-1': value}}, {upsert:true, w:1 }, function(err, result) {
					if(callback) {
						callback(err, result);
					}
	 			});
 			} else {
 				module.listAppend(key, value, callback);
 			}

 		})
	}

	module.listAppend = function(key, value, callback) {
		db.collection('objects').update({ _key: key }, { $push: { array: value } }, {upsert:true, w:1}, function(err, result) {
			if(callback) {
				callback(err, result);
			}
		});
	}

	module.getListRange = function(key, start, stop, callback) {

		if(stop === -1) {
			// mongo doesnt allow -1 as the count argument in slice
			// pass in a large value to retrieve the whole array
			stop = Math.pow(2, 31) - 2;
		}

		db.collection('objects').findOne({_key:key}, { array: { $slice: [start, stop - start + 1] }}, function(err, data) {
			if(err) {
				return callback(err);
			}
			if(data && data.array) {
				callback(null, data.array);
			} else {
				callback(null, []);
			}
		});
	}


}(exports));

