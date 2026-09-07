const { AsyncLocalStorage } = require('node:async_hooks');

const accountStorage = new AsyncLocalStorage();

function getActiveAccountEmail() {
  const store = accountStorage.getStore();
  return store?.email || null;
}

function runWithAccount(email, fn) {
  if (!email) return fn();
  return accountStorage.run({ email: email.toLowerCase() }, fn);
}

module.exports = {
  accountStorage,
  getActiveAccountEmail,
  runWithAccount
};
