/**
 * Debug Event Handler Registration
 */

const fs = require('fs');

// Read socket.js and check which event handlers should be registered
const socketContent = fs.readFileSync('./src/socket.js', 'utf8');

// Find all socket.on handlers
const handlers = [];
const lines = socketContent.split('\n');

lines.forEach((line, index) => {
  if (line.includes("socket.on('")) {
    const match = line.match(/socket\.on\('([^']+)'/);
    if (match) {
      handlers.push({
        event: match[1],
        line: index + 1,
        content: line.trim()
      });
    }
  }
});

console.log('🔍 Event handlers that should be registered:');
handlers.forEach(handler => {
  console.log(`  ${handler.event} (line ${handler.line})`);
});

console.log(`\n📊 Total handlers found: ${handlers.length}`);

// Check if send-dm is in the list
const sendDmHandler = handlers.find(h => h.event === 'send-dm');
if (sendDmHandler) {
  console.log(`✅ send-dm handler found at line ${sendDmHandler.line}`);
} else {
  console.log(`❌ send-dm handler NOT found!`);
}

// Check for syntax issues around send-dm
const sendDmIndex = socketContent.indexOf("socket.on('send-dm'");
if (sendDmIndex !== -1) {
  const beforeSendDm = socketContent.substring(Math.max(0, sendDmIndex - 200), sendDmIndex);
  const afterSendDm = socketContent.substring(sendDmIndex, sendDmIndex + 200);
  
  console.log('\n🔍 Context around send-dm handler:');
  console.log('BEFORE:', beforeSendDm.split('\n').slice(-5).join('\n'));
  console.log('AFTER:', afterSendDm.split('\n').slice(0, 5).join('\n'));
}
