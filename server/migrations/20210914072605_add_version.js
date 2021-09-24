
exports.up = function(knex) {
  return knex.schema.alterTable('documents', (table) => {
    table.integer('version').notNullable().defaultTo(0);
  })
};

exports.down = function(knex) {
  return knex.schema.alterTable('documents', (table) => {
    table.dropColumn('version');
  })
};
