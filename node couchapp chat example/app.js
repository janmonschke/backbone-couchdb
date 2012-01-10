 var couchapp = require('couchapp'), 
path = require('path');

ddoc = 
    { _id:'_design/backbone_example', 
      rewrites : [ {from:"/", to:'index.html'}, 
		   {from:"/api", to:'../../'}, 
		   {from:"/api/*", to:'../../*'},
		   {from:"/*", to:'*'}]};

ddoc.views = {};
ddoc.views.byCollection = {
    map:function(doc) {
	if (doc.collection) {
	    emit(doc.collection, doc);
	}
    }
};
ddoc.views.messages = {
    map:function(doc) {
	if (doc.collection == "messages") {
	    emit(doc.collection, doc);
	}
    }
};
//this was changed from 'recent-items'
ddoc.views.recentItems = {
    map: function(doc) {
	if (doc.created_at) {
	    emit(doc.created_at, doc);
	}
    }
};
ddoc.filters = {
    messages : function(doc) {
	// IMPORTANT: in order to retrieve remove events, you should add "doc._deleted" to the filter
	// only send notifications for message docs
	if (doc.collection == "messages" || doc._deleted)
	    return true;
	else
	    return false;
    },
    by_collection : function(doc, req){
	if(doc.collection && req.query &&req.query.collection && doc.collection == req.query.collection) // does the collection match?
	    return true;
	else if (req.query && req.query.collection && doc._deleted) // has the document been deleted?
	return true;
	else // do nothing
	    return false;
    },
    private_messages : function(doc, req) {
	// only send notifications to the recipient
	if (doc.collection == "private_messages" && doc.to == req.userCtx.name)
	    return true;
	else
	    return false;
    }
};

couchapp.loadAttachments(ddoc, path.join(__dirname, 'attachments'));

module.exports = ddoc;