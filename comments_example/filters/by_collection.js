function(doc, req){
  if(doc.collection && req.query &&req.query.collection && doc.collection == req.query.collection) // does the collection match?
    return true;
  else if (req.query && req.query.collection && doc._deleted) // has the document been deleted?
    return true;
  else
    return false;
}