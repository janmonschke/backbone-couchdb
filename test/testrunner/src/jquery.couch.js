// $.couch is used to communicate with a CouchDB server, the server methods can
// be called directly without creating an instance. Typically all methods are
// passed an <code>options</code> object which defines a success callback which
// is called with the data returned from the http request to CouchDB, you can
// find the other settings that can be used in the <code>options</code> object
// from <a href="http://api.jquery.com/jQuery.ajax/#jQuery-ajax-settings">
// jQuery.ajax settings</a>
//
//     $.couch.activeTasks({
//       success: function (data) {
//         console.log(data);
//       }
//     });
//
// Outputs (for example):
//
//     [
//       {
//         "pid" : "<0.11599.0>",
//         "status" : "Copied 0 of 18369 changes (0%)",
//         "task" : "recipes",
//         "type" : "Database Compaction"
//       }
//     ]
(function($) {

  $.couch = $.couch || {};

  function encodeDocId(docID) {
    var parts = docID.split("/");
    if (parts[0] == "_design") {
      parts.shift();
      return "_design/" + encodeURIComponent(parts.join('/'));
    }
    return encodeURIComponent(docID);
  }

  var uuidCache = [];

  $.extend($.couch, {
    urlPrefix: '',

    // You can obtain a list of active tasks by using the `/_active_tasks` URL.
    // The result is a JSON array of the currently running tasks, with each task
    // being described with a single object.
    activeTasks: function(options) {
      return ajax(
        {url: this.urlPrefix + "/_active_tasks"},
        options,
        "Active task status could not be retrieved"
      );
    },

    // Returns a list of all the databases in the CouchDB instance
    allDbs: function(options) {
      return ajax(
        {url: this.urlPrefix + "/_all_dbs"},
        options,
        "An error occurred retrieving the list of all databases"
      );
    },

    // View and edit the CouchDB configuration, called with just the options
    // parameter the entire config is returned, you can be more specific by
    // passing the section and option parameters, if you specify a value that
    // value will be stored in the configuration.
    config: function(options, section, option, value) {
      var req = {url: this.urlPrefix + "/_config/"};
      if (section) {
        req.url += encodeURIComponent(section) + "/";
        if (option) {
          req.url += encodeURIComponent(option);
        }
      }
      if (value === null) {
        req.type = "DELETE";
      } else if (value !== undefined) {
        req.type = "PUT";
        req.data = toJSON(value);
        req.contentType = "application/json";
        req.processData = false
      }

      return ajax(req, options,
        "An error occurred retrieving/updating the server configuration"
      );
    },

    // Returns the session information for the currently logged in user.
    session: function(options) {
      options = options || {};
      return $.ajax({
        type: "GET", url: this.urlPrefix + "/_session",
        beforeSend: function(xhr) {
            xhr.setRequestHeader('Accept', 'application/json');
        },
        complete: function(req) {
          var resp = $.parseJSON(req.responseText);
          if (req.status == 200) {
            if (options.success) options.success(resp);
          } else if (options.error) {
            options.error(req.status, resp.error, resp.reason);
          } else {
            alert("An error occurred getting session info: " + resp.reason);
          }
        }
      });
    },

    userDb : function(callback) {
      return $.couch.session({
        success : function(resp) {
          var userDb = $.couch.db(resp.info.authentication_db);
          callback(userDb);
        }
      });
    },

    // Create a new user on the CouchDB server, <code>user_doc</code> is an
    // object with a <code>name</code> field and other information you want
    // to store relating to that user, for example
    // `{"name": "daleharvey"}`
    signup: function(user_doc, password, options) {
      options = options || {};
      // prepare user doc based on name and password
      user_doc = this.prepareUserDoc(user_doc, password);
      return $.couch.userDb(function(db) {
        db.saveDoc(user_doc, options);
      });
    },

    // Populates a user doc with a new password.
    prepareUserDoc: function(user_doc, new_password) {
      if (typeof hex_sha1 == "undefined") {
        alert("creating a user doc requires sha1.js to be loaded in the page");
        return;
      }
      var user_prefix = "org.couchdb.user:";
      user_doc._id = user_doc._id || user_prefix + user_doc.name;
      if (new_password) {
        // handle the password crypto
        user_doc.salt = $.couch.newUUID();
        user_doc.password_sha = hex_sha1(new_password + user_doc.salt);
      }
      user_doc.type = "user";
      if (!user_doc.roles) {
        user_doc.roles = [];
      }
      return user_doc;
    },

     // Authenticate against CouchDB, the <code>options</code> parameter is
     // expected to have <code>name</code> and <code>password</code> fields.
    login: function(options) {
      options = options || {};
      return $.ajax({
        type: "POST", url: this.urlPrefix + "/_session", dataType: "json",
        data: {name: options.name, password: options.password},
        beforeSend: function(xhr) {
            xhr.setRequestHeader('Accept', 'application/json');
        },
        complete: function(req) {
          var resp = $.parseJSON(req.responseText);
          if (req.status == 200) {
            if (options.success) options.success(resp);
          } else if (options.error) {
            options.error(req.status, resp.error, resp.reason);
          } else {
            alert("An error occurred logging in: " + resp.reason);
          }
        }
      });
    },


    // Delete your current CouchDB user session
    logout: function(options) {
      options = options || {};
      return $.ajax({
        type: "DELETE", url: this.urlPrefix + "/_session", dataType: "json",
        username : "_", password : "_",
        beforeSend: function(xhr) {
            xhr.setRequestHeader('Accept', 'application/json');
        },
        complete: function(req) {
          var resp = $.parseJSON(req.responseText);
          if (req.status == 200) {
            if (options.success) options.success(resp);
          } else if (options.error) {
            options.error(req.status, resp.error, resp.reason);
          } else {
            alert("An error occurred logging out: " + resp.reason);
          }
        }
      });
    },

    // $.couch.db is used to communicate with a specific CouchDB database
    // <pre><code>var $db = $.couch.db("mydatabase");
    // $db.allApps({
    //  success: function (data) {
    //    ... process data ...
    //  }
    //});
    //</code></pre>
    db: function(name, db_opts) {
      db_opts = db_opts || {};
      var rawDocs = {};
      function maybeApplyVersion(doc) {
        if (doc._id && doc._rev && rawDocs[doc._id] &&
            rawDocs[doc._id].rev == doc._rev) {
          // todo: can we use commonjs require here?
          if (typeof Base64 == "undefined") {
            alert("please include /_utils/script/base64.js in the page for " +
                  "base64 support");
            return false;
          } else {
            doc._attachments = doc._attachments || {};
            doc._attachments["rev-"+doc._rev.split("-")[0]] = {
              content_type :"application/json",
              data : Base64.encode(rawDocs[doc._id].raw)
            };
            return true;
          }
        }
      };
      return {
        name: name,
        uri: this.urlPrefix + "/" + encodeURIComponent(name) + "/",

        // Request compaction of the specified database.
        compact: function(options) {
          $.extend(options, {successStatus: 202});
          return ajax({
              type: "POST", url: this.uri + "_compact",
              data: "", processData: false
            },
            options,
            "The database could not be compacted"
          );
        },

        // Cleans up the cached view output on disk for a given view.
        viewCleanup: function(options) {
          $.extend(options, {successStatus: 202});
          return ajax({
              type: "POST", url: this.uri + "_view_cleanup",
              data: "", processData: false
            },
            options,
            "The views could not be cleaned up"
          );
        },

        // Compacts the view indexes associated with the specified design
        // document. You can use this in place of the full database compaction
        // if you know a specific set of view indexes have been affected by a
        // recent database change.
        compactView: function(groupname, options) {
          $.extend(options, {successStatus: 202});
          return ajax({
              type: "POST", url: this.uri + "_compact/" + groupname,
              data: "", processData: false
            },
            options,
            "The view could not be compacted"
          );
        },

        // Create a new database
        create: function(options) {
          $.extend(options, {successStatus: 201});
          return ajax({
              type: "PUT", url: this.uri, contentType: "application/json",
              data: "", processData: false
            },
            options,
            "The database could not be created"
          );
        },

        // Deletes the specified database, and all the documents and
        // attachments contained within it.
        drop: function(options) {
          return ajax(
            {type: "DELETE", url: this.uri},
            options,
            "The database could not be deleted"
          );
        },

        // Gets information about the specified database.
        info: function(options) {
          return ajax(
            {url: this.uri},
            options,
            "Database information could not be retrieved"
          );
        },

        // $.couch.db.changes provides an API for subscribing to the changes
        // feed
        // <pre><code>var $changes = $.couch.db("mydatabase").changes();
        // $changes.onChange = function (data) {
        //    ... process data ...
        // }
        // $changes.stop();
        // </code></pre>
        changes: function(since, options) {

          options = options || {};
          // set up the promise object within a closure for this handler
          var timeout = 100, db = this, active = true,
            listeners = [],
            promise = {
              // Add a listener callback
              onChange : function(fun) {
                listeners.push(fun);
              },
              // Stop subscribing to the changes feed
              stop : function() {
                active = false;
              }
            };

          // call each listener when there is a change
          function triggerListeners(resp) {
            $.each(listeners, function() {
              this(resp);
            });
          };

          // when there is a change, call any listeners, then check for
          // another change
          options.success = function(resp) {
            timeout = 100;
            if (active) {
              since = resp.last_seq;
              triggerListeners(resp);
              getChangesSince();
            };
          };
          options.error = function() {
            if (active) {
              setTimeout(getChangesSince, timeout);
              timeout = timeout * 2;
            }
          };

          // actually make the changes request
          function getChangesSince() {
            var opts = $.extend({heartbeat : 10 * 1000}, options, {
              feed : "longpoll",
              since : since
            });
            ajax(
              {url: db.uri + "_changes"+encodeOptions(opts)},
              options,
              "Error connecting to "+db.uri+"/_changes."
            );
          }

          // start the first request
          if (since) {
            getChangesSince();
          } else {
            db.info({
              success : function(info) {
                since = info.update_seq;
                getChangesSince();
              }
            });
          }
          return promise;
        },

         // Fetch all the docs in this db, you can specify an array of keys to
         // fetch by passing the <code>keys</code> field in the
         // <code>options</code>
         // parameter.
        allDocs: function(options) {
          var type = "GET";
          var data = null;
          if (options["keys"]) {
            type = "POST";
            var keys = options["keys"];
            delete options["keys"];
            data = toJSON({ "keys": keys });
          }
          return ajax({
              type: type,
              data: data,
              url: this.uri + "_all_docs" + encodeOptions(options)
            },
            options,
            "An error occurred retrieving a list of all documents"
          );
        },

        // Fetch all the design docs in this db
        allDesignDocs: function(options) {
          return this.allDocs($.extend(
            {startkey:"_design", endkey:"_design0"}, options));
        },

         // Fetch all the design docs with an index.html, <code>options</code>
         // parameter expects an <code>eachApp</code> field which is a callback
         // called on each app found.
        allApps: function(options) {
          options = options || {};
          var self = this;
          if (options.eachApp) {
            this.allDesignDocs({
              success: function(resp) {
                $.each(resp.rows, function() {
                  self.openDoc(this.id, {
                    success: function(ddoc) {
                      var index, appPath, appName = ddoc._id.split('/');
                      appName.shift();
                      appName = appName.join('/');
                      index = ddoc.couchapp && ddoc.couchapp.index;
                      if (index) {
                        appPath = ['', name, ddoc._id, index].join('/');
                      } else if (ddoc._attachments &&
                                 ddoc._attachments["index.html"]) {
                        appPath = ['', name, ddoc._id, "index.html"].join('/');
                      }
                      if (appPath) options.eachApp(appName, appPath, ddoc);
                    }
                  });
                });
              }
            });
          } else {
            alert("Please provide an eachApp function for allApps()");
          }
        },

        // Returns the specified doc from the specified db.
        openDoc: function(docId, options, ajaxOptions) {
          options = options || {};
          if (db_opts.attachPrevRev || options.attachPrevRev) {
            $.extend(options, {
              beforeSuccess : function(req, doc) {
                rawDocs[doc._id] = {
                  rev : doc._rev,
                  raw : req.responseText
                };
              }
            });
          } else {
            $.extend(options, {
              beforeSuccess : function(req, doc) {
                if (doc["jquery.couch.attachPrevRev"]) {
                  rawDocs[doc._id] = {
                    rev : doc._rev,
                    raw : req.responseText
                  };
                }
              }
            });
          }
          return ajax({url: this.uri + encodeDocId(docId) + encodeOptions(options)},
            options,
            "The document could not be retrieved",
            ajaxOptions
          );
        },

        // Create a new document in the specified database, using the supplied
        // JSON document structure. If the JSON structure includes the _id
        // field, then the document will be created with the specified document
        // ID. If the _id field is not specified, a new unique ID will be
        // generated.
        saveDoc: function(doc, options) {
          options = options || {};
          var db = this;
          var beforeSend = fullCommit(options);
          if (doc._id === undefined) {
            var method = "POST";
            var uri = this.uri;
          } else {
            var method = "PUT";
            var uri = this.uri + encodeDocId(doc._id);
          }
          var versioned = maybeApplyVersion(doc);
          return $.ajax({
            type: method, url: uri + encodeOptions(options),
            contentType: "application/json",
            dataType: "json", data: toJSON(doc),
            beforeSend : beforeSend,
            complete: function(req) {
              var resp = $.parseJSON(req.responseText);
              if (req.status == 200 || req.status == 201 || req.status == 202) {
                doc._id = resp.id;
                doc._rev = resp.rev;
                if (versioned) {
                  db.openDoc(doc._id, {
                    attachPrevRev : true,
                    success : function(d) {
                      doc._attachments = d._attachments;
                      if (options.success) options.success(resp);
                    }
                  });
                } else {
                  if (options.success) options.success(resp);
                }
              } else if (options.error) {
                options.error(req.status, resp.error, resp.reason);
              } else {
                alert("The document could not be saved: " + resp.reason);
              }
            }
          });
        },

        // Save a list of documents
        bulkSave: function(docs, options) {
          var beforeSend = fullCommit(options);
          $.extend(options, {successStatus: 201, beforeSend : beforeSend});
          return ajax({
              type: "POST",
              url: this.uri + "_bulk_docs" + encodeOptions(options),
              contentType: "application/json", data: toJSON(docs)
            },
            options,
            "The documents could not be saved"
          );
        },

        // Deletes the specified document from the database. You must supply
        // the current (latest) revision and <code>id</code> of the document
        // to delete eg <code>removeDoc({_id:"mydoc", _rev: "1-2345"})</code>
        removeDoc: function(doc, options) {
          return ajax({
              type: "DELETE",
              url: this.uri +
                   encodeDocId(doc._id) +
                   encodeOptions({rev: doc._rev})
            },
            options,
            "The document could not be deleted"
          );
        },

        // Remove a set of documents
        bulkRemove: function(docs, options){
          docs.docs = $.each(
            docs.docs, function(i, doc){
              doc._deleted = true;
            }
          );
          $.extend(options, {successStatus: 201});
          return ajax({
              type: "POST",
              url: this.uri + "_bulk_docs" + encodeOptions(options),
              data: toJSON(docs)
            },
            options,
            "The documents could not be deleted"
          );
        },

        // The COPY command (which is non-standard HTTP) copies an existing
        // document to a new or existing document.
        copyDoc: function(docId, options, ajaxOptions) {
          ajaxOptions = $.extend(ajaxOptions, {
            complete: function(req) {
              var resp = $.parseJSON(req.responseText);
              if (req.status == 201) {
                if (options.success) options.success(resp);
              } else if (options.error) {
                options.error(req.status, resp.error, resp.reason);
              } else {
                alert("The document could not be copied: " + resp.reason);
              }
            }
          });
          return ajax({
              type: "COPY",
              url: this.uri + encodeDocId(docId)
            },
            options,
            "The document could not be copied",
            ajaxOptions
          );
        },

        //  Creates (and executes) a temporary view based on the view function
        //  supplied in the JSON request.
        query: function(mapFun, reduceFun, language, options) {
          language = language || "javascript";
          if (typeof(mapFun) !== "string") {
            mapFun = mapFun.toSource ? mapFun.toSource()
              : "(" + mapFun.toString() + ")";
          }
          var body = {language: language, map: mapFun};
          if (reduceFun != null) {
            if (typeof(reduceFun) !== "string")
              reduceFun = reduceFun.toSource ? reduceFun.toSource()
                : "(" + reduceFun.toString() + ")";
            body.reduce = reduceFun;
          }
          return ajax({
              type: "POST",
              url: this.uri + "_temp_view" + encodeOptions(options),
              contentType: "application/json", data: toJSON(body)
            },
            options,
            "An error occurred querying the database"
          );
        },

        // Fetch a _list view output, you can specify a list of
        // <code>keys</code> in the options object to recieve only those keys.
        list: function(list, view, options, ajaxOptions) {
          var list = list.split('/');
          var options = options || {};
          var type = 'GET';
          var data = null;
          if (options['keys']) {
            type = 'POST';
            var keys = options['keys'];
            delete options['keys'];
            data = toJSON({'keys': keys });
          }
          return ajax({
              type: type,
              data: data,
              url: this.uri + '_design/' + list[0] +
                   '/_list/' + list[1] + '/' + view + encodeOptions(options)
              },
              ajaxOptions, 'An error occured accessing the list'
          );
        },

	// Execute an update function for a given document.
	updateDoc: function(updateFun, doc_id, options, ajaxOptions) {

	  var ddoc_fun = updateFun.split('/');
	  var options = options || {};
	  var type = 'PUT';
          var data = null;

	  return $.ajax({
	    type: type,
	    data: data,
            beforeSend: function(xhr) {
              xhr.setRequestHeader('Accept', '*/*');
            },
            complete: function(req) {
              var resp = req.responseText;
              if (req.status == 201) {
                if (options.success) options.success(resp);
              } else if (options.error) {
                options.error(req.status, resp.error, resp.reason);
              } else {
                alert("An error occurred getting session info: " + resp.reason);
              }
            },
	    url: this.uri + '_design/' + ddoc_fun[0] +
	      '/_update/' + ddoc_fun[1] + '/' + doc_id + encodeOptions(options)
	  });
	},

        // Executes the specified view-name from the specified design-doc
        // design document, you can specify a list of <code>keys</code>
        // in the options object to recieve only those keys.
        view: function(name, options) {
          var name = name.split('/');
          var options = options || {};
          var type = "GET";
          var data= null;
          if (options["keys"]) {
            type = "POST";
            var keys = options["keys"];
            delete options["keys"];
            data = toJSON({ "keys": keys });
          }
          return ajax({
              type: type,
              data: data,
              url: this.uri + "_design/" + name[0] +
                   "/_view/" + name[1] + encodeOptions(options)
            },
            options, "An error occurred accessing the view"
          );
        },

        // Fetch an arbitrary CouchDB database property
        getDbProperty: function(propName, options, ajaxOptions) {
          return ajax({url: this.uri + propName + encodeOptions(options)},
            options,
            "The property could not be retrieved",
            ajaxOptions
          );
        },

        // Set an arbitrary CouchDB database property
        setDbProperty: function(propName, propValue, options, ajaxOptions) {
          return ajax({
            type: "PUT",
            url: this.uri + propName + encodeOptions(options),
            data : JSON.stringify(propValue)
          },
            options,
            "The property could not be updated",
            ajaxOptions
          );
        }
      };
    },

    encodeDocId: encodeDocId,

    // Accessing the root of a CouchDB instance returns meta information about
    // the instance. The response is a JSON structure containing information
    // about the server, including a welcome message and the version of the
    // server.
    info: function(options) {
      return ajax(
        {url: this.urlPrefix + "/"},
        options,
        "Server information could not be retrieved"
      );
    },

    // Request, configure, or stop, a replication operation.
    replicate: function(source, target, ajaxOptions, repOpts) {
      repOpts = $.extend({source: source, target: target}, repOpts);
      if (repOpts.continuous && !repOpts.cancel) {
        ajaxOptions.successStatus = 202;
      }
      return ajax({
          type: "POST", url: this.urlPrefix + "/_replicate",
          data: JSON.stringify(repOpts),
          contentType: "application/json"
        },
        ajaxOptions,
        "Replication failed"
      );
    },

    // Fetch a new UUID
    newUUID: function(cacheNum) {
      if (cacheNum === undefined) {
        cacheNum = 1;
      }
      if (!uuidCache.length) {
        ajax({url: this.urlPrefix + "/_uuids", data: {count: cacheNum}, async:
              false}, {
            success: function(resp) {
              uuidCache = resp.uuids;
            }
          },
          "Failed to retrieve UUID batch."
        );
      }
      return uuidCache.shift();
    }
  });

  function ajax(obj, options, errorMessage, ajaxOptions) {

    var defaultAjaxOpts = {
      contentType: "application/json",
      headers:{"Accept": "application/json"}
    };

    options = $.extend({successStatus: 200}, options);
    ajaxOptions = $.extend(defaultAjaxOpts, ajaxOptions);
    errorMessage = errorMessage || "Unknown error";
    return $.ajax($.extend($.extend({
      type: "GET", dataType: "json",
      beforeSend: function(xhr){
        if(ajaxOptions && ajaxOptions.headers){
          for (var header in ajaxOptions.headers){
            xhr.setRequestHeader(header, ajaxOptions.headers[header]);
          }
        }
      },
      complete: function(req) {
        try {
          var resp = $.parseJSON(req.responseText);
        } catch(e) {
          if (options.error) {
            options.error(req.status, req, e);
          } else {
            alert(errorMessage + ": " + e);
          }
          return;
        }
        if (options.ajaxStart) {
          options.ajaxStart(resp);
        }
        if (req.status == options.successStatus) {
          if (options.beforeSuccess) options.beforeSuccess(req, resp);
          if (options.success) options.success(resp);
        } else if (options.error) {
          options.error(req.status, resp && resp.error ||
                        errorMessage, resp && resp.reason || "no response");
        } else {
          alert(errorMessage + ": " + resp.reason);
        }
      }
    }, obj), ajaxOptions));
  }

  function fullCommit(options) {
    var options = options || {};
    if (typeof options.ensure_full_commit !== "undefined") {
      var commit = options.ensure_full_commit;
      delete options.ensure_full_commit;
      return function(xhr) {
        xhr.setRequestHeader('Accept', 'application/json');
        xhr.setRequestHeader("X-Couch-Full-Commit", commit.toString());
      };
    }
  };

  // Convert a options object to an url query string.
  // ex: {key:'value',key2:'value2'} becomes '?key="value"&key2="value2"'
  function encodeOptions(options) {
    var buf = [];
    if (typeof(options) === "object" && options !== null) {
      for (var name in options) {
        if ($.inArray(name,
                      ["error", "success", "beforeSuccess", "ajaxStart"]) >= 0)
          continue;
        var value = options[name];
        if ($.inArray(name, ["key", "startkey", "endkey"]) >= 0) {
          value = toJSON(value);
        }
        buf.push(encodeURIComponent(name) + "=" + encodeURIComponent(value));
      }
    }
    return buf.length ? "?" + buf.join("&") : "";
  }

  function toJSON(obj) {
    return obj !== null ? JSON.stringify(obj) : null;
  }

})(jQuery);