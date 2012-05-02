QUnit.begin = function(){
  Backbone.couch_connector.config.db_name = "backbone_test_db";
  Backbone.couch_connector.config.ddoc_name = "backbone_connector_test";
  Backbone.couch_connector.config.global_changes = false;

  // overwrite the defaul requests, because /db is the new db namespace
  $.ajaxPrefilter(function( options, originalOptions, jqXHR ) {
    options.url = '/db' + options.url;
  });

};

module("helpers");

test("extracts all possible urls correctly", function(){
  raises(function(){
    Backbone.couch_connector.helpers.extract_collection_name();
  }, "throws error when no model is passed to function");
  
  equals(Backbone.couch_connector.helpers.extract_collection_name({}), "", "Returns empty string when no url specified");
  
  var model_w_url_field = {
    collection : {
      url : "comments" 
    }
  };
  equals(Backbone.couch_connector.helpers.extract_collection_name(model_w_url_field), "comments", "obj with url field");
  
  model_w_url_field.collection.url = "comments/"
  equals(Backbone.couch_connector.helpers.extract_collection_name(model_w_url_field), "comments", "obj with url field (trailing slash)");
  
  model_w_url_field.collection.url = "/comments"
  equals(Backbone.couch_connector.helpers.extract_collection_name(model_w_url_field), "comments", "obj with url field (leading slash)");
  
  model_w_url_field.collection.url = "/comments/"
  equals(Backbone.couch_connector.helpers.extract_collection_name(model_w_url_field), "comments", "obj with url field (leading & trailing slash)");
  
  var model_w_url_field_and_id = {
    collection : {
      url : "comments/3"
    }
  };
  equals(Backbone.couch_connector.helpers.extract_collection_name(model_w_url_field_and_id), "comments", "obj with url field and id");
  
  var model_w_url_method = {
    collection : {
      url : function(){
        return "comments"
      } 
    }
  };
  equals(Backbone.couch_connector.helpers.extract_collection_name(model_w_url_method), "comments", "obj with url method");
  
  var model_w_url_method_and_id = {
    collection : {
      url : function(){
        return "comments/32"
      } 
    }
  };
  equals(Backbone.couch_connector.helpers.extract_collection_name(model_w_url_method_and_id), "comments", "obj with url method that also returns an id");
});

test("creates a proper db object", function(){
  ok(true);
});

module("db relevant", {
  setup : function(){
    stop();
    db = $.couch.db("backbone_test_db")
    db.create({
      success : function(){
        var ddoc = {
           "_id": "_design/backbone_connector_test",
           "language": "javascript",
           "views": {
               "byCollection": {
                   "map": "function(doc) {\n  if (doc.collection) {\n    emit(doc.collection, doc);\n  }\n};"
               },
               "testView": {
                    "map": "function(doc) {\n  if (doc.body && doc.body == 'test3') {\n    emit(doc.title, doc);\n  }\n};"
                }
           }
        };
        var test_doc_1 = { _id : "test_id_4711", collection: "comments", title: "test1", body : "test1" };
        var test_doc_2 = { collection: "comments", title: "test2", body : "test2" };
        var test_doc_3 = { collection: "tests", title: "test3", body : "test3" };
        var test_doc_4 = { collection: "hallo", title: "test4", body : "test3" };
        ct = 0
        opts = { success : function(){ ct++; if(ct == 5){ start(); } }, error : function(){ alert("could no create a test doc"); }};
        db.saveDoc(ddoc, opts);
        db.saveDoc(test_doc_1, opts);
        db.saveDoc(test_doc_2, opts);
        db.saveDoc(test_doc_3, opts);
        db.saveDoc(test_doc_4, opts);
      },
      error : function(error){
        stop();
        console.log(arguments);
        alert("could not create testdb, please delete it manually");
      }
    });
  },
  teardown : function(){
    stop();
    $.couch.db("backbone_test_db").drop({
      success : function(){
        start();
      },
      error : function(){
        alert("could not delete testdb, please delete it manually");
      }
    });
  }
});

asyncTest("read collection" , function(){
  var CommentModel = Backbone.Model.extend({
    __testing : function(){}
  });
	var CommentList = Backbone.Collection.extend({
	  db : {
	    changes : false
	  },
		url : "/comments",
		model : CommentModel
	});
	var Comments = new CommentList();
	Comments.fetch({
	  success : function(){
      equals(Comments.length, 2, "Collection contains the right amount of docs after fetching");
      notEqual(Comments.get("test_id_4711"), undefined, "Element that had an _id before is also in Collection");
      notEqual(Comments.get("test_id_4711").__testing, undefined, "Element has the right type");
	    start();
	  }
	});
	
});

asyncTest("read collection with custom view" , function(){
	var CommentList = Backbone.Collection.extend({
	  db : {
	    view : "testView",
	    changes : false,
	    keys : null
	  },
		url : "/comments"
	});
	var Comments = new CommentList();
	Comments.fetch({
	  success : function(){
      equals(Comments.length, 2, "Collection contains the right amount of docs after fetching");
	    start();
	  },
	  error : function(){
	    console.log("error", arguments);
	  }
	});
});

asyncTest("read collection with custom view and custom keys" , function(){
	var CommentList = Backbone.Collection.extend({
	  db : {
	    view : "testView",
	    changes : false,
	    keys : ["test4"]
	  },
		url : "/comments"
	});
	var Comments = new CommentList();
	Comments.fetch({
	  success : function(){
      equals(Comments.length, 1, "Collection contains the right amount of docs after fetching");
	    start();
	  },
	  error : function(){
	    console.log("error");
	  }
	});
});

asyncTest("read model", function(){
  var CommentModel = Backbone.Model.extend({});
  
  mymodel = new CommentModel({
    _id : "test_id_4711"
  });
  mymodel.fetch({
    success : function(){
      equals(mymodel.id, "test_id_4711", "Model has the same id after fetching it");
      equals(mymodel.get('body'), "test1", "Model has a certain body field");
      start();
    },
    error : function(){
      alert("Model could not be fetched");
    }
  });
  
  broken_model = new CommentModel();
  raises(function(){
    broken_model.fetch();
  }, "throws error when model has no id property");
});

asyncTest("create model", function(){
  var CommentModel = Backbone.Model.extend({});
	
  mymodel = new CommentModel({
    body : "I'm new",
    random : "string"
  });
  
  mymodel.url = "";
  
  mymodel.save({},{
    success : function(model){
      notEqual(model.id, undefined, "The model shoud have an id");
      notEqual(model.toJSON()._id, undefined, "The model shoud have an _id when converted to JSON");
      notEqual(model.toJSON()._rev, undefined, "The model shoud have a _rev field");
      start();
    },
    error : function(){
      console.log("in err cb", arguments);
    }
  });
});

asyncTest("update model", function(){
  var CommentModel = Backbone.Model.extend({});
  
  mymodel = new CommentModel({
    _id : "test_id_4711"
  });
  
  mymodel.url = "";
  
  var changed_text = "I've changed!!!";
  
  mymodel.fetch({
    success : function(){
      mymodel.set({text : changed_text});
      var the_rev = mymodel.get('_rev');
      mymodel.save({},{
        success : function(){
          var new_model = new CommentModel({
            _id : "test_id_4711"
          });
          new_model.fetch({
            success: function(){
             start();
             equals(new_model.get('text'), changed_text, "The new text should have been saved to the model");
             notEqual(new_model.get('_rev'), the_rev, "The _rev attribute should have changed");
            }
          });
        },
        error : function(){}
      })
    },
    error : function(){
      alert("Model could not be fetched");
    }
  });
});

asyncTest("delete model", function(){
  var CommentModel = Backbone.Model.extend({});
  
  mymodel = new CommentModel({
    _id : "test_id_4711"
  });
  mymodel.fetch({
    success : function(){
      mymodel.destroy({
        success : function(){
          mymodel.fetch({
            success : function(){
              start();
              ok(false, "Model has not been deleted in the DB");
            },
            error : function(){
              start();
              ok(true, "Model has been deleted and could not get retrieved again.")
            }
          });
        },
        error : function(){
          start();
          ok(false, "Model could not be deleted from the DB")
        }
      });
    },
    error : function(){
      ok(false, "error retrieving the model");
      start();
    }
  });
});

QUnit.done = function(){
  console.log("done")
};