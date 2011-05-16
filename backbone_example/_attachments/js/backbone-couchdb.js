(function() {
  /*
  (c) 2011 Jan Monschke
  backbone-couchdb.js is licensed under the MIT license.
  */  var con;
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
  Backbone.couch_connector = con = {
    config: {
      db_name: "backbone_connect",
      ddoc_name: "backbone_example",
      view_name: "byCollection",
      global_changes: true,
      base_url: null
    },
    helpers: {
      extract_collection_name: function(model) {
        var _name, _splitted;
        if (model == null) {
          throw new Error("No model has been passed");
        }
        if (!(((model.collection != null) && (model.collection.url != null)) || (model.url != null))) {
          return "";
        }
        if (model.url != null) {
          _name = _.isFunction(model.url) ? model.url() : model.url;
        } else {
          _name = _.isFunction(model.collection.url) ? model.collection.url() : model.collection.url;
        }
        if (_name[0] === "/") {
          _name = _name.slice(1, _name.length);
        }
        _splitted = _name.split("/");
        _name = _splitted.length > 0 ? _splitted[0] : _name;
        _name = _name.replace("/", "");
        return _name;
      },
      make_db: function() {
        var db;
        db = $.couch.db(con.config.db_name);
        if (con.config.base_url != null) {
          db.uri = "" + con.config.base_url + "/" + con.config.db_name + "/";
        }
        return db;
      }
    },
    _changes: {
      registered_collections: [],
      registered_models: [],
      handler: null,
      _update_seq: null,
      add: function(coll) {
        if (this.registered_collections.indexOf(coll === -1)) {
          this.registered_collections.push(coll);
        }
        if (this.handler == null) {
          return this.activate_changes();
        }
      },
      activate_changes: function() {
        var db;
        db = con.helpers.make_db();
        if (typeof _update_seq != "undefined" && _update_seq !== null) {
          return this.listen(db);
        } else {
          return this.prepare(db);
        }
      },
      prepare: function(db) {
        return db.info({
          success: __bind(function(data) {
            this._update_seq = data.update_seq || 0;
            return this.listen(db);
          }, this)
        });
      },
      listen: function(db) {
        this.handler = db.changes(this._update_seq);
        return this.handler.onChange(__bind(function(changes) {
          return console.log("change", changes);
        }, this));
      }
    },
    read: function(model, opts) {
      if (model.models) {
        return con.read_collection(model, opts);
      } else {
        return con.read_model(model, opts);
      }
    },
    /*
    Reads all docs of a collection based on the byCollection view or a custom view specified by the collection
    */
    read_collection: function(coll, opts) {
      var keys, _view;
      _view = this.config.view_name;
      keys = [this.helpers.extract_collection_name(coll)];
      if (coll.db != null) {
        if (coll.db.changes || this.config.global_changes) {
          this._changes.add(coll);
        }
        if (coll.db.view != null) {
          _view = coll.db.view;
          keys = null;
        }
      }
      console.log("read", keys, _view);
      return this.helpers.make_db().view("" + this.config.ddoc_name + "/" + _view, {
        keys: keys,
        success: __bind(function(data) {
          var doc, _i, _len, _ref, _temp;
          _temp = [];
          _ref = data.rows;
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            doc = _ref[_i];
            _temp.push(doc.value);
          }
          return opts.success(_temp);
        }, this),
        error: function() {
          return opts.error();
        }
      });
    },
    read_model: function(model, opts) {
      if (!model.id) {
        throw new Error("The model has no id property, so I can't fetch it from the db");
      }
      return this.helpers.make_db().openDoc(model.id, {
        success: function(doc) {
          return opts.success(doc);
        },
        error: function() {
          return opts.error();
        }
      });
    },
    create: function(model, opts) {
      var coll, vals;
      vals = model.toJSON();
      coll = this.helpers.extract_collection_name(model);
      if (coll.length > 0) {
        vals.collection = coll;
      }
      return this.helpers.make_db().saveDoc(vals, {
        success: function(doc) {
          return opts.success({
            _id: doc.id,
            _rev: doc.rev
          });
        },
        error: function() {
          return opts.error();
        }
      });
    },
    /* jquery.couch.js uses the same method for updating as it uses for creating a document, so we can use the `create` method here. */
    update: function(model, opts) {
      return this.create(model, opts);
    }
  };
  Backbone.sync = function(method, model, opts) {
    console.log("sync", arguments);
    switch (method) {
      case "read":
        return con.read(model, opts);
      case "create":
        return con.create(model, opts);
      case "update":
        return con.update(model, opts);
    }
  };
  _.extend(Backbone.Collection.prototype, {
    register_for_changes: function() {
      return con._changes.add(this);
    }
  });
  _.extend(Backbone.Model.prototype, {
    idAttribute: "_id",
    register_for_changes: function() {
      return con._changes.add(this);
    }
  });
}).call(this);
