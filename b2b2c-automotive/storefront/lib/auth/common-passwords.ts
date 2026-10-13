// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Passwords of at least ten characters that appear in every breach list (workstream P D7, reused by Q). Lower case; the check lowercases the input.
export const COMMON_PASSWORDS: ReadonlySet<string> = new Set([
  '1234567890', '0123456789', '12345678910', '1234567891', '123456789012', '1q2w3e4r5t', '1q2w3e4r5t6y', '1qaz2wsx3edc', '1qazxsw23edc',
  'qwertyuiop', 'qwertyuiop123', 'qwerty1234', 'qwerty12345', 'qwerty123456', 'qwertyuiop1', 'asdfghjkl', 'asdfghjkl1', 'asdfghjkl123', 'asdfghjkl;',
  'zxcvbnm123', 'zxcvbnmasd', 'qazwsxedcrfv', 'qazwsxedc123', 'password12', 'password123', 'password1234', 'password12345', 'password123456', 'password1!',
  'password123!', 'password!23', 'passw0rd123', 'p@ssw0rd12', 'p@ssword123', 'p@ssw0rd123', 'pa$$w0rd12', 'passwort12', 'passwort123', 'passwort1234', 'passwort123!',
  'kennwort12', 'kennwort123', 'meinpasswort', 'meinpasswort1', 'meinpasswort123', 'geheim1234', 'geheim12345', 'geheimgeheim', 'hallo12345', 'hallo123456', 'hallohallo',
  'willkommen', 'willkommen1', 'willkommen12', 'willkommen123', 'letmein123', 'letmein1234', 'letmeinplease', 'welcome123', 'welcome1234', 'welcome12345',
  'welcome123!', 'iloveyou12', 'iloveyou123', 'iloveyou1234', 'iloveyou!!', 'iloveyou2', 'trustno1234', 'sunshine12', 'sunshine123', 'princess12', 'princess123',
  'football12', 'football123', 'baseball12', 'baseball123', 'superman12', 'superman123', 'batman1234', 'batman12345', 'starwars12', 'starwars123', 'pokemon123',
  'pokemon1234', 'mustang123', 'mercedes12', 'mercedes123', 'porsche911', 'porsche123', 'bmw1234567', 'volkswagen', 'volkswagen1', 'volkswagen123', 'audi123456',
  'golf123456', 'fussball12', 'fussball123', 'fussball1234', 'bayernmunchen', 'bayernmuenchen', 'borussia09', 'schalke0404', 'dragon1234', 'dragon12345', 'monkey1234',
  'monkey12345', 'master1234', 'master12345', 'shadow1234', 'shadow12345', 'michael123', 'michael1234', 'jennifer12', 'jessica123', 'charlie123', 'charlie1234',
  'ashley1234', 'nicole1234', 'daniel1234', 'thomas1234', 'andreas123', 'michael12!', 'abcdefghij', 'abcdefghijk', 'abcdefg123', 'abcd123456', 'abcd1234567',
  'abc1234567', 'abc123abc1', 'aaaaaaaaaa', 'aaaaaaaaaaa', 'bbbbbbbbbb', 'zzzzzzzzzz', '0000000000', '1111111111', '2222222222', '3333333333', '4444444444',
  '5555555555', '6666666666', '7777777777', '8888888888', '9999999999', '1212121212', '1231231231', '1234512345', '1234554321', '9876543210', '0987654321',
  '1357924680', '2468013579', '1234567899', '1234567812', '123456789a', '123456789q', 'a123456789', 'q123456789', 'z123456789', '1qaz@wsx3e', '1qaz2wsx3e',
  'admin12345', 'admin123456', 'administrator', 'administrator1', 'adminadmin', 'adminadmin1', 'root123456', 'rootroot12', 'test123456', 'test1234567', 'testtest12',
  'testing123', 'testtest123', 'user123456', 'login12345', 'login123456', 'default123', 'changeme12', 'changeme123', 'changeme1234', 'change_me12', 'secret1234',
  'secret12345', 'secretsecret', 'qwerty!234', 'qwertz1234', 'qwertz12345', 'qwertzuiop', 'qwertzuiop1', 'qwertzui123', 'asdfghjkl9', 'yxcvbnm123', 'yxcvbnmasd',
  'malva12345', 'malva123456', 'starter123', 'starter1234', 'commercetools', 'commercetools1', 'commercetools123', 'summer2024!', 'summer2025!',
  'winter2024!', 'winter2025!', 'spring2025!', 'autumn2025!', 'sommer2025!', 'winter2026!', 'summer2026!', 'sommer2026!', 'passwort2025', 'passwort2026', 'password2025', 'password2026',
]);

/** True when the password (any case) is on the list of common passwords. */
export const isCommonPassword = (password: string): boolean => COMMON_PASSWORDS.has(password.toLowerCase());
