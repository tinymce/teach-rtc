
exports.up = function (knex) {
  return knex.schema
    .alterTable('documents', table => {
      table.dropForeign('lockUser');
      table.dropColumn('lockUser');
      table.dropColumn('lockTime');
      table.integer('version').notNullable().defaultTo(0);
    })
    .createTable('keys', table => {
      table.string('document').notNullable();
      table.datetime('created').notNullable();
      table.string('key').notNullable();
      table.primary(['document', 'created']);
      table.foreign('document').references('documents.uuid');
    });
};

exports.down = function (knex) {
  return knex.schema
    .alterTable('documents', table => {
      table.dropColumn('version');
      table.string('lockUser');
      table.datetime('lockTime');
      table.foreign('lockUser').references('users.username').onDelete('CASCADE').onUpdate('RESTRICT');
    })
    .dropTableIfExists('keys');
};
