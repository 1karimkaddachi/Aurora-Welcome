import test from 'node:test';
import assert from 'node:assert/strict';
import { commandData } from '../src/bot/commands/data.js';
import { handleWelcomeCommand, autocompleteWelcome, resetWelcomeConfig } from '../src/bot/commands/welcome.js';
import { handleLeaveCommand } from '../src/bot/commands/leave.js';
import { handleInvitesCommand } from '../src/bot/commands/invites.js';

function flattenOptions(options = []) {
  return options.flatMap((option) => [option, ...flattenOptions(option.options || [])]);
}

const welcome = commandData.find((command) => command.name === 'welcome');
const leave = commandData.find((command) => command.name === 'leave');
const invites = commandData.find((command) => command.name === 'invites');

test('registers the three top-level commands', () => {
  assert.equal(commandData.length, 3);
  assert.deepEqual(commandData.map((command) => command.name).sort(), ['invites', 'leave', 'welcome']);
  for (const command of commandData) {
    assert.ok(command.description.length > 0);
    assert.equal(command.options.length <= 25, true);
  }
});

test('welcome command exposes every documented workflow', () => {
  const direct = new Set(welcome.options.filter((option) => option.type === 1).map((option) => option.name));
  for (const name of ['setup', 'enable', 'disable', 'channel', 'message', 'preview', 'test', 'image', 'reset', 'stats']) {
    assert.ok(direct.has(name), `missing /welcome ${name}`);
  }
  const groups = new Map(welcome.options.filter((option) => option.type === 2).map((group) => [group.name, group]));
  for (const group of ['template', 'autorole', 'dm', 'buttons']) assert.ok(groups.has(group), `missing /welcome ${group}`);
  assert.deepEqual(
    groups.get('template').options.map((sub) => sub.name).sort(),
    ['apply', 'delete', 'list', 'save'],
  );
  assert.deepEqual(
    groups.get('autorole').options.map((sub) => sub.name).sort(),
    ['add', 'list', 'remove'],
  );
  assert.deepEqual(
    groups.get('dm').options.map((sub) => sub.name).sort(),
    ['disable', 'enable', 'message', 'mode'],
  );
  assert.deepEqual(
    groups.get('buttons').options.map((sub) => sub.name).sort(),
    ['add', 'list', 'remove'],
  );
});

test('leave and invites commands are complete', () => {
  assert.deepEqual(
    leave.options.map((option) => option.name).sort(),
    ['channel', 'disable', 'enable', 'image', 'message', 'preview', 'setup', 'test'],
  );
  assert.deepEqual(invites.options.map((option) => option.name).sort(), ['leaderboard', 'user']);
});

test('all command options are Discord-valid primitives', () => {
  for (const command of commandData) {
    for (const option of flattenOptions(command.options)) {
      assert.equal(typeof option.name, 'string');
      assert.ok(option.name.length > 0);
      assert.ok(option.name.length <= 32);
      assert.equal(typeof option.description, 'string');
      if (option.choices) {
        for (const choice of option.choices) {
          assert.equal(typeof choice.name, 'string');
          assert.equal(typeof choice.value, 'string');
        }
      }
    }
  }
});

test('command modules export executable handlers', () => {
  assert.equal(typeof handleWelcomeCommand, 'function');
  assert.equal(typeof autocompleteWelcome, 'function');
  assert.equal(typeof handleLeaveCommand, 'function');
  assert.equal(typeof handleInvitesCommand, 'function');
  assert.equal(typeof resetWelcomeConfig, 'function');
});

test('slash command JSON is serializable', () => {
  const json = JSON.stringify(commandData);
  assert.ok(json.length > 1000);
  const parsed = JSON.parse(json);
  assert.equal(parsed.length, 3);
});
