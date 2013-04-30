var	RDB = require('./redis.js');

(function(Posts) {
	//data structure
	//*global:next_post_id
	// *pid:1:content
	// *pid:1:uid
	// *pid:1:timestamp
	// ***pid:1:replies
	// *uid:1:posts



	Posts.get = function(callback, tid, start, end) {
		if (start == null) start = 0;
		if (end == null) end = start + 10;

		RDB.lrange('tid:' + tid + ':posts', start, end, function(pids) {

			var content = [],
				uid = [],
				timestamp = [];

			for (var i=0, ii=pids.length; i<ii; i++) {
				content.push('pid:' + pids[i] + ':content');
				uid.push('pid:' + pids[i] + ':uid');
				timestamp.push('pid:' + pids[i] + ':timestamp');
			}

			if (pids.length > 0) {
				RDB.multi()
					.mget(content)
					.mget(uid)
					.mget(timestamp)
					.exec(function(err, replies) {
						content = replies[0];
						uid = replies[1];
						timestamp = replies[2];

						var posts = [];
						for (var i=0, ii=content.length; i<ii; i++) {
							posts.push({
								'content' : content[i],
								'uid' : uid[i],
								'timestamp' : timestamp[i]
							});
						}

						callback({'posts': posts});
					});
			} else {
				callback({});
			}


		});

	}


	Posts.reply = function() {

	};

	Posts.create = function(uid, content, callback) {
		console.log("global uid "+uid);
		
		if (uid === null) return;
		
		RDB.incr('global:next_post_id', function(pid) {
			// Posts Info
			RDB.set('pid:' + pid + ':content', content);
			RDB.set('pid:' + pid + ':uid', uid);
			RDB.set('pid:' + pid + ':timestamp', new Date().getTime());
			
			// User Details - move this out later
			RDB.lpush('uid:' + uid + ':posts', pid);
			
			if (callback) callback(pid);
		});

	}

}(exports));