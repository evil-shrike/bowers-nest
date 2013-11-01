// Remove the quotes below and fill in <proxy-ip> and <proxy-port> if you use a proxy
//require('./http-proxy')('<proxy-ip>',<proxy-port>);

var sqlite3 = require('sqlite3').verbose();
var dbName = 'nest.db';

module.exports = function ( grunt ) {
	var srvConfig = grunt.file.readJSON('config.json');

    require('matchdep').filterDev('grunt-*').forEach(grunt.loadNpmTasks);

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        jshint: {
            all: [
                'Gruntfile.js',
                'bowers-nest.js',
                'server.js'
            ],
            options: {
                jshintrc: '.jshintrc'
            }
        },
        jasmine_node: {
            projectRoot: 'server',
            src: 'server.js',
            spec: 'server.spec.js',
            requirejs: false,
            forceExit: true
        },
        curl: {
            long: {
                src: 'http://bower.herokuapp.com/packages',
                dest: 'git_repositories/all_bower_packages.json'
            }
        },
        clean: {
            all: 'git_repositories'
        }
    });

    grunt.registerTask('test', ['jshint', 'jasmine_node']);
    grunt.registerTask('sync', ['clean', 'curl', 'sync_db']);
    grunt.registerTask('default', ['test', 'sync']);

    grunt.registerTask('init_db', 'Initialize database', function(){
        var done = this.async();
        var db = new sqlite3.Database(dbName);
        db.run('CREATE table IF NOT EXISTS packages(id integer primary key, ' +
            'name varchar(500) UNIQUE, url varchar(500) UNIQUE, created_at date);', function(){
            done();
        });
    });

    grunt.registerTask('sync_db', 'Sync database to Bower official registry', function(){
        var done = this.async();
        var bowerDB = grunt.file.readJSON('git_repositories/all_bower_packages.json');
        var db = new sqlite3.Database(dbName);
        var util = require('util');

        db.run('CREATE table IF NOT EXISTS packages(id integer primary key, ' +
            'name varchar(500) UNIQUE, url varchar(500) UNIQUE, created_at date);', function(){

            var count = 1;
            bowerDB.forEach(function(e){
                count++;
                if(e.name !== ''){
                    var temp = count;
                    db.run('INSERT INTO packages ("name", "url", "created_at") VALUES ($name, $url, $date)',
                        {
                            $name: e.name,
                            $url: e.url,
                            $date: new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')
                        }, function(err, row){
                            util.print('Syncing with database ' + (100.0 * temp / bowerDB.length).toFixed(2) + '% ' + ' done.\r');
                            if(temp >= bowerDB.length) { // check if all callbacks have been called
                                console.log('');
                                done();
                            }
                        });
                }
            });
        });
    });

	grunt.registerTask('register', function(name){
		if(name === undefined || name === ''){
			grunt.fail.warn('Module name cannot be undefined.');
			return;
		}

		var fs = require('fs');
		var gitRepoName = name + '.git';

		var url = grunt.option('url')
		if (!url) {
			url = 'http://' + srvConfig.server + ':' + srvConfig.port + '/git/' + gitRepoName;
		}       	
		grunt.log.writeln('Endpoint: ' + url);

        var done = this.async();
        if (!fs.existsSync('git_repositories/' + gitRepoName) && name !== undefined && name !== '') {
        	
            var db = new sqlite3.Database(dbName);

            var cp = require('child_process');
            cp.exec('git init --bare git_repositories/' + gitRepoName, function (err, stdout, stderr) {
            	grunt.log.writeln('Created a new git bare repository: ' + gitRepoName.green);

            	//var cmd = 'xcopy git_repositories/' + gitRepoName + '/hooks/post-update.sample git_repositories/' + gitRepoName + '/hooks/post-update';
            	grunt.log.writeln('Setting up git hooks');

            	grunt.file.copy('git_repositories/' + gitRepoName + '/hooks/post-update.sample', 'git_repositories/' + gitRepoName + '/hooks/post-update');

    		    db.run('CREATE table IF NOT EXISTS packages(id integer primary key, ' +
    	    	       'name varchar(500) UNIQUE, url varchar(500) UNIQUE, created_at date);', function() {

                	db.run('INSERT INTO packages ("name", "url", "created_at") VALUES ($name, $url, $date)',
		        		{
    		                $name: name,
        		            $url:  url,
            		        $date: new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')
                		}, function(err, row) {
                    		grunt.log.writeln('Module "' + name + ' is registered.');
                        	grunt.log.writeln('Run these commands in your package directory to finalize the process:');
	                        grunt.log.writeln('\tgit remote add bower ' + url);
	    	                grunt.log.writeln('\tgit push bower master');
    	    	            done();
        	    	    });
		        });
            });
        }
        else{
            var db = new sqlite3.Database(dbName);
			db.run('UPDATE packages SET "url"=$url, "created_at"=$date WHERE "name"=$name', {
				$name: name,
				$url:  url,
				$date: new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '')
			}, function(err, row) {
				if (err) {
					grunt.fail.warn('Error update: ' + err);
				} else {
					grunt.log.writeln('Module "' + name + '" is updated.');
				}
				done();
			});
            //grunt.fail.warn('Module "' + name + '" already exists.');
        }
    });

	grunt.registerTask('unregister', function(name) {
		var done = this.async();
		var db = new sqlite3.Database(dbName);

		db.run('CREATE table IF NOT EXISTS packages(id integer primary key, ' +
                'name varchar(500) UNIQUE, url varchar(500) UNIQUE, created_at date);', function(){
                if (!name) {
                	db.run('DELETE FROM packages', function () {
                        grunt.log.writeln('All modules are unregistered.');
                        grunt.log.writeln('Don\'t forget to remove the git_repository.');
                        done();
                	});
                } else {
	                db.run('DELETE FROM packages WHERE name = $name', {$name: name}, function(err, row){
                        grunt.log.writeln('Module "' + name + ' is unregistered.');
                        grunt.log.writeln('Don\'t forget to remove the git_repository.');
                        done();
                    });
                }
		});
    });

	grunt.registerTask('list', function () {
		var db = new sqlite3.Database(dbName);
		var done = this.async();
		db.run('CREATE table IF NOT EXISTS packages(id integer primary key, ' +
                'name varchar(500) UNIQUE, url varchar(500) UNIQUE, created_at date);', function(){
			db.each('SELECT * FROM packages', function(err, row){
				grunt.log.writeln('Package: "'+row.name+'" url="' + row.url + '"');
				done();
			});
		});
    });

    /*
    grunt.registerTask('config', function(ip,port){
        var gruntTextReplace = require('grunt-text-replace/lib/grunt-text-replace');
        console.log(ip);
        console.log(port);
        gruntTextReplace.replace({
            src: ['config.json'],
            overwrite: true,
            replacements: [
                {
                    from:/127.0.0.1/g,
                    to: ip
                },
                {
                    from:/8001/g,
                    to: port
                }
            ]
        });
    });
    */
};
