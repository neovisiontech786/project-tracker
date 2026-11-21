import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canAccessFinance,canManageProjects,canManageTeam,canReadProject,isTeamRole} from '../src/lib/team-policy.ts';

test('admin founder member roles have minimum privileges',()=>{
  assert.equal(canManageTeam('admin'),true);
  assert.equal(canManageTeam('founder'),false);
  assert.equal(canManageTeam('member'),false);
  assert.equal(canManageProjects('admin'),true);
  assert.equal(canManageProjects('founder'),true);
  assert.equal(canManageProjects('member'),false);
  assert.equal(canAccessFinance('member'),false);
  assert.equal(canAccessFinance('founder'),true);
});
test('private projects remain creator only regardless of role',()=>{
  const project={createdById:'user_creator',ownerId:'user_other',isPrivate:true};
  assert.equal(canReadProject({id:'user_admin',role:'admin'},project),false);
  assert.equal(canReadProject({id:'user_creator',role:'member'},project),true);
});
test('shared projects visible to admins founders and individually assigned members',()=>{
  const project={createdById:'user_creator',ownerId:'user_assignee',isPrivate:false};
  assert.equal(canReadProject({id:'user_admin',role:'admin'},project),true);
  assert.equal(canReadProject({id:'user_founder',role:'founder'},project),true);
  assert.equal(canReadProject({id:'user_assignee',role:'member'},project),true);
  assert.equal(canReadProject({id:'user_stranger',role:'member'},project),false);
});
test('unknown roles cannot be accepted',()=>{
  for(const value of ['owner','super-admin','Kabir','Naushad','','viewer',null])assert.equal(isTeamRole(value),false);
  for(const role of ['admin','founder','member'])assert.equal(isTeamRole(role),true);
});
test('server routes enforce dynamic identity and access checks',()=>{
  const root=new URL('../src/',import.meta.url);
  const server=readFileSync(new URL('lib/server.ts',root),'utf8');
  const payments=readFileSync(new URL('app/api/payments/route.ts',root),'utf8');
  const team=readFileSync(new URL('app/api/team/route.ts',root),'utf8');
  assert.match(server,/team_invitations/);
  assert.match(server,/revoked_at/);
  assert.doesNotMatch(server,/ALLOWED_FOUNDER_EMAILS/);
  assert.match(payments,/requireRole\(actor,\['admin','founder'\]\)/);
  assert.match(team,/requireRole\(actor,\['admin'\]\)/);
});
