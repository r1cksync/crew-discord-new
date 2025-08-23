/**
 * Socket.js Syntax Checker
 */

console.log('🔍 Checking socket.js syntax...');

try {
  require('./src/socket.js');
  console.log('✅ socket.js syntax is valid');
} catch (error) {
  console.error('❌ socket.js has syntax errors:', error.message);
  console.error('Full error:', error);
}

// Check if socket handlers are properly registered
const fs = require('fs');
const content = fs.readFileSync('./src/socket.js', 'utf8');

console.log('\n🔍 Checking for duplicate send-dm handlers...');
const sendDmMatches = content.match(/socket\.on\('send-dm'/g);
console.log(`Found ${sendDmMatches ? sendDmMatches.length : 0} send-dm handlers`);

console.log('\n🔍 Checking for unclosed brackets...');
const openBraces = (content.match(/{/g) || []).length;
const closeBraces = (content.match(/}/g) || []).length;
console.log(`Open braces: ${openBraces}, Close braces: ${closeBraces}`);

if (openBraces !== closeBraces) {
  console.log('❌ Bracket mismatch detected!');
} else {
  console.log('✅ Brackets are balanced');
}

console.log('\n🔍 File analysis complete');
