const fs = require('fs');

fs.readdir('./images', (err, files) => {
    files = files.filter(file => !file.endsWith(".js") && !file.endsWith(".json") && file !== "فرم نظر سنجی .png");
    // Keep the festival banner first so it is the first wall painting.
    files.sort((a, b) => a === "1.jpg" ? -1 : b === "1.jpg" ? 1 : a.localeCompare(b));
    const list = files.map(file => ({
        title: file.split('.').slice(0, -1).join('.'),
        file,
    }));
    let json = JSON.stringify({images:list}, null, 4);
    fs.writeFileSync('./images/images.json', json);
});
