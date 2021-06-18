
exports.up = function(knex) {
  return knex.schema
  .createTable('users', table => {
    table.string('username').notNullable().unique().primary();
    // technically this is the "<salt>.<hash>" not just the hash
    table.string('hash').notNullable();
    // a display name that does not need to be unique and may contain unicode
    table.string('fullName').notNullable();
  })
  .createTable('documents', table => {
    table.uuid('uuid').notNullable().unique().primary();
    table.string('title').notNullable();
    table.string('content').notNullable().defaultTo('');
    table.string('lockUser');
    table.datetime('lockTime');
    table.foreign('lockUser').references('users.username').onDelete('CASCADE').onUpdate('RESTRICT');
  })
  .createTable('collaborators', table => {
    table.string('document').notNullable();
    table.string('user').notNullable();
    // bitset
    // 4 = may change collaborators
    // 2 = may write
    // 1 = may read
    table.integer('permissions').unsigned().notNullable();
    table.primary(['document', 'user']);
    table.foreign('document').references('documents.uuid').onDelete('CASCADE').onUpdate('RESTRICT');
    table.foreign('user').references('users.username').onDelete('CASCADE').onUpdate('RESTRICT');
  });
};

exports.down = function(knex) {
  return knex.schema
  .dropTableIfExists('collaborators')
  .dropTableIfExists('documents')
  .dropTableIfExists('users');
};
