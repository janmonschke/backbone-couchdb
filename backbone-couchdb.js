/*
(c) 2011 Jan Monschke
v1.1
backbone-couchdb.js is licensed under the MIT license.
*/

(function() {
  var _vlist=[];
  var _llist={};
  var _irow=0;
  function emit(key, value) {
    _vlist.push({'key':key, 'value':value});
  }
  function getRow() {
    if (!_vlist.length || _irow >= _vlist.length) return(null);
    return(_vlist[_irow++]);
  }
  function send(doc) {
    _llist= doc;
  }
  function toJSON(doc) {
    return(doc);
  }

  var __hasProp = Object.prototype.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor; child.__super__ = parent.prototype; return child; },
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  Backbone.Model = (function(_super) {

    __extends(Model, _super);

    function Model() {
      Model.__super__.constructor.apply(this, arguments);
    }

    Model.prototype.idAttribute = "_id";

    Model.prototype.clone = function() {
      var new_model;
      new_model = new this.constructor(this);
      if (new_model.attributes._id) delete new_model.attributes._id;
      if (new_model.attributes._rev) delete new_model.attributes._rev;
      return new_model;
    };

    return Model;

  })(Backbone.Model);

  Backbone.Collection = (function(_super) {

    __extends(Collection, _super);

    function Collection() {
      this._db_on_change = __bind(this._db_on_change, this);
      this._db_prepared_for_changes = __bind(this._db_prepared_for_changes, this);

      this.con= {
        config: {
          db_name: "backbone_connect",
          ddoc_name: "backbone_example",
          view_name: "byCollection",
          list_name: null,
          global_changes: false,
          base_url: null,
          view_func: null,
//          uid: null,      // UUID (for debugging)
          list_func: null
        },
        helpers: {
          extract_collection_name: function(model) {
            var _name, _splitted;
            if (model == null) throw new Error("No model has been passed");
            if (!(((model.collection != null) && (model.collection.url != null)) || (model.url != null))) {
              return "";
            }
            if (model.url != null) {
              _name = _.isFunction(model.url) ? model.url() : model.url;
            } else {
              _name = _.isFunction(model.collection.url) ? model.collection.url() : model.collection.url;
            }
            if (_name[0] === "/") _name = _name.slice(1, _name.length);
            _splitted = _name.split("/");
            _name = _splitted.length > 0 ? _splitted[0] : _name;
            _name = _name.replace("/", "");
            return _name;
          },
          make_db: function(conn) {
            var db;
            db = $.couch.db(conn.config.db_name);
            if (conn.config.base_url != null) {
              db.uri = "" + conn.config.base_url + "/" + conn.config.db_name + "/";
            }
            return db;
          }
        },
        read: function(model, opts) {
          if (model.models) {
            return this.read_collection(model, opts);
          } else {
            return this.read_model(model, opts);
          }
        },
        read_collection: function(coll, opts) {
          var keys, _opts, _view, _ddoc, _list, _this = this;
          _view = this.config.view_name;
          _ddoc = this.config.ddoc_name;
          _list = this.config.list_name;
          keys = [this.helpers.extract_collection_name(coll)];
          // Set UUID (for debugging):
/*          if (!this.config.uid) {
	    this.config.uid= ((new Date()).getTime() + "" + Math.floor(Math.random()*1000000)).substr(0,18);

          }*/
          if (coll.db != null) {
            if (coll.db.base_url != null) {
              this.config.base_url = coll.db.base_url;
            }
            if (coll.db.db_name != null) {
              this.config.db_name = coll.db.db_name;
            }
            if (coll.db.changes || this.config.global_changes) {
              coll.listen_to_changes();
            }
            if (coll.db.view != null) {
              _view = coll.db.view;
            }
            if (coll.db.ddoc != null) _ddoc = coll.db.ddoc;
            if (coll.db.keys != null) keys = coll.db.keys;
            if (coll.db.list != null) {
              _list = coll.db.list; 
            }
          }
          _opts = {
            keys: keys,
            success: function(data) {
              var doc, _i, _len, _ref, _temp;
              _temp = [];
              _ref = data.rows;
              for (_i = 0, _len = _ref.length; _i < _len; _i++) {
                doc = _ref[_i];
                (doc.value) ? _temp.push(doc.value) : _temp.push(doc.doc);
              }
              opts.success(_temp);
              return opts.complete();
            },
            error: function() {
              opts.error();
              return opts.complete();
            }
          };
          if (opts.limit != null) _opts.limit = opts.limit;
          if (opts.skip != null) _opts.skip = opts.skip;
          if (opts.include_docs != null) _opts.include_docs = opts.include_docs;
          if (opts.startkey != null) _opts.startkey = opts.startkey;
          if (opts.endkey != null) _opts.endkey = opts.endkey;
          if (opts.startkey_docid != null) _opts.startkey_docid = opts.startkey_docid;
          if (opts.endkey_docid != null) _opts.endkey_docid = opts.endkey_docid;
          if ((coll.db != null) && (coll.db.view != null) && !(coll.db.keys != null)) {
            delete _opts.keys;
          }
          if (coll.db.list || coll.db.view != 'byCollection') {
	    this.config.view_name= coll.db.view;
	    this.config.list_name= coll.db.list;
            this.helpers.make_db(this).openDoc("_design/" + _ddoc, {
              success: function(doc) {
                if (doc.views[_view].map) {
                  eval('var fu=' + doc.views[_view].map);
                  _this.config.view_func= fu;
                  // When uncommenting the following line, uncomment declaration and setting of UUID above
                  //console.log('db: ' + _this.config.db_name + '  view: ' + _this.config.view_name + ' view_func: ' + _this.config.view_func + ' sqn=' + _this.config.uid);
                }
                if (doc.lists[_list]) {
                  eval('var fu=' + doc.lists[_list]);
                  _this.config.list_func= fu;
//                  console.log('list_func: ' + _this.config.list_func);
                }
              },
              error: function() {
                console.log("Unable to read design document");
              }
            });
          }
          if (_list != null) {
            return this.helpers.make_db(this).list("" + _ddoc + "/" + _list, "" + _view, _opts);
          } else {
            return this.helpers.make_db(this).view("" + _ddoc + "/" + _view, _opts);
          }
        },
        read_model: function(model, opts) {
          if (!model.id) {
            throw new Error("The model has no id property, so it can't get fetched from the database");
          }
          return this.helpers.make_db(this).openDoc(model.id, {
            success: function(doc) {
              opts.success(doc);
              return opts.complete();
            },
            error: function() {
              opts.error();
              return opts.complete();
            }
          });
        },
        create: function(model, opts) {
          var coll, vals;
          vals = model.toJSON();
          coll = this.helpers.extract_collection_name(model);
          if (!this.config.view_func && !this.config.list_func && coll.length > 0) vals.collection = coll;
          for (var i in opts['exclude']) {
            if (opts['exclude'][i] in vals)
              delete vals[opts['exclude'][i]];
          }

          return this.helpers.make_db(this).saveDoc(vals, {
            success: function(doc) {
              opts.success({
                _id: doc.id,
                _rev: doc.rev
              });
              return opts.complete();
            },
            error: function() {
              opts.error();
              return opts.complete();
            }
          });
        },
        update: function(model, opts) {
          return this.create(model, opts);
        },
        del: function(model, opts) {
          return this.helpers.make_db(this).removeDoc(model.toJSON(), {
            success: function() {
              return opts.success();
            },
            error: function(nr, req, e) {
              if (e === "deleted") {
                opts.success();
                return opts.complete();
              } else {
                opts.error();
                return opts.complete();
              }
            }
          });
        }
      };
      Collection.__super__.constructor.apply(this, arguments);
    }

    Collection.prototype.model = Backbone.Model;

    Collection.prototype.initialize = function() {
      if (!this._db_changes_enabled && ((this.db && this.db.changes) || this.con.config.global_changes)) {
        return this.listen_to_changes();
      }
    };

    Collection.prototype.sync = function(method, model, opts) {
      if (opts.success == null) opts.success = function() {};
      if (opts.error == null) opts.error = function() {};
      if (opts.complete == null) opts.complete = function() {};
      switch (method) {
      case "read":
        return this.con.read(model, opts);
      case "create":
        return this.con.create(model, opts);
      case "update":
        return this.con.update(model, opts);
      case "delete":
        return this.con.del(model, opts);
      }
    };

    Collection.prototype.listen_to_changes = function() {
      if (!this._db_changes_enabled) {
        this._db_changes_enabled = true;
        if (!this._db_inst) this._db_inst = this.con.helpers.make_db(this.con);
        return this._db_inst.info({
          "success": this._db_prepared_for_changes
        });
      }
    };

    Collection.prototype.stop_changes = function() {
      this._db_changes_enabled = false;
      if (this._db_changes_handler != null) {
        this._db_changes_handler.stop();
        return this._db_changes_handler = null;
      }
    };

    Collection.prototype._db_prepared_for_changes = function(data) {
      var opts,
        _this = this;
      this._db_update_seq = data.update_seq || 0;
      opts = {
        include_docs: true,
        collection: this.con.helpers.extract_collection_name(this),
        filter: "" + this.con.config.ddoc_name + "/by_collection"
      };
      _.extend(opts, this.db);
      return _.defer(function() {
        _this._db_changes_handler = _this._db_inst.changes(_this._db_update_seq, opts);
        return _this._db_changes_handler.onChange(_this._db_on_change);
      });
    };

    Collection.prototype._db_on_change = function(changes) {
      var obj, _doc, _i, _len, _rref, _ref, _results;
      _rref= _ref = changes.results;
      // Create couchcdb view:
      if (this.con.config.view_func) {
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
              _doc = _ref[_i];
              if (_doc) {
                  if (_doc.doc)
                      this.con.config.view_func(_doc.doc);
                  else
                      this.con.config.view_func(_doc);
              }
          }
          _rref=[];
          if (this.con.config.list_func) {
              // Create couchcdb list:
              this.con.config.list_func();
              for (_i = 0, _len = _llist.total_rows; _i < _len; _i++) {
                  var ref={
                      doc: _llist.rows[_i].value,
                      id: _llist.rows[_i].id
                  };
                  _rref.push(ref);
              }
          } else {
              for (_i = 0, _len = _vlist.length; _i < _len; _i++) {
                  var ref={
                      doc: _vlist.rows[_i].value,
                      id: _vlist.rows[_i].id
                  };
                  _rref.push(ref);
              }
          }
      }
      _results = [];
      for (_i = 0, _len = _rref.length; _i < _len; _i++) {
        _doc = _rref[_i];
//        console.log('reported doc ' + _doc.id);
        obj = this.get(_doc.id);
        if (obj != null) {
          if (_doc.deleted) {
//            console.log('deleted doc ' + _doc.id);
            _results.push(this.remove(obj));
          } else {
            if (obj.get("_rev") !== _doc.doc._rev) {
//              console.log('changed doc ' + _doc.id);
              _results.push(obj.set(_doc.doc));
            } else {
//              console.log('no changes: ' + _doc.id);
              _results.push(void 0);
            }
          }
        } else {
          if (!_doc.deleted) {
//            console.log('new doc: ' + _doc.id);
            _results.push(this.add(_doc.doc));
          } else {
//            console.log('new but already deleted: ' + _doc.id);
            _results.push(void 0);
          }
        }
      }
      return _results;
    };

    return Collection;

  })(Backbone.Collection);

}).call(this);
