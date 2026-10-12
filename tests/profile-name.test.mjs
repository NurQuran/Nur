import assert from "node:assert/strict";
import test from "node:test";
import { profileNameIssue, allowedProfileName } from "../lib/profileName.ts";

test("accepts ordinary multilingual names without rejecting innocent substrings", () => {
  for(const name of ["", "  ", "Anas", "Élodie", "François", "Constance", "Scunthorpe", "Dickinson", "عبد الله", "محمد", "خالد", "نور", "O’Connor", "Jean-Pierre"])
    assert.equal(profileNameIssue(name),null,name);
  assert.equal(allowedProfileName("  Élodie  "),"Élodie");
  assert.equal(allowedProfileName({name:"Anas"}),"");
});

test("rejects profanity in French, English and Arabic including common obfuscations", () => {
  for(const name of ["fuck", "Anas fucking", "f.u.c.k", "f u c k", "f\u200buck", "sh1t", "CÖNNARD", "enculé", "p u t a i n", "قَحْبَة", "الكلب", "كـسـمـك", "خرا", "9ahba", "123", "<script>", "a".repeat(61)])
    assert.equal(profileNameIssue(name),"inappropriate",name);
  assert.equal(allowedProfileName("connard"),"");
});

test("the reserved name is blocked regardless of case, spaces or punctuation", () => {
  for(const name of ["Dilmi AOUKLI", "dilmi aoukli", " DILMI   AOUKLI ", "Dilmi-Aoukli", "Dilmi\u200b Aoukli"])
    assert.equal(profileNameIssue(name),"reserved",name);
});
