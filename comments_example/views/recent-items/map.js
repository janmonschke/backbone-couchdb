function(doc) {
  if (doc.created_at) {
    emit(doc.created_at, doc);
  }
};