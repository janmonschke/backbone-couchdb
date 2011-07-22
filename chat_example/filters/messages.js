function(doc) {
  // IMPORTANT: in order to retrieve remove events, you should add "doc._deleted" to the filter
  if (doc.collection == "messages" || doc._deleted)
    return true;
  else
    return false;
};