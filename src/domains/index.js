/**
 * Domain-Driven Architecture Aggregator
 */

module.exports = {
  BaseService: require('./base/BaseService'),
  ...require('./daily'),
  ...require('./welfare'),
  ...require('./combat'),
  ...require('./growth'),
  ...require('./leisure'),
  ...require('./activity')
};
