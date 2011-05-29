function(doc, req) {
  if (doc.collection == "private_messages" && doc.to == req.userCtx.name)
    return true;
  else
    return false;
};