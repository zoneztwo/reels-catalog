// --- NODE 18 POLYFILL FOR UNDICI/FETCH ---
const { File } = require('buffer');
if (!global.File) {
    global.File = File;
}
// -----------------------------------------

const express = require('express');
const cors = require('cors');
const ogs = require('open-graph-scraper');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const csv = require('csv-parser');
const xmlbuilder = require('xmlbuilder');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = 'super-gizli-anahtar-degistirilebilir'; 

// --- MIDDLEWARES ---
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors());
app.use(express.json());

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 500 
});
app.use(limiter);

app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    maxAge: '1d' 
}));

const upload = multer({ dest: 'uploads/temp/' });

// --- FILE PATHS ---
const DB_FILE = path.join(__dirname, 'db.json');
const CATEGORIES_FILE = path.join(__dirname, 'categories.json');
const USERS_FILE = path.join(__dirname, 'users.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// --- INIT FILES ---
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify([]));
if (!fs.existsSync(CATEGORIES_FILE)) fs.writeFileSync(CATEGORIES_FILE, JSON.stringify(["Genel"]));

if (!fs.existsSync(USERS_FILE)) {
    const defaultPassword = bcrypt.hashSync('admin123', 10);
    const defaultUser = [{ username: 'admin', password: defaultPassword }];
    fs.writeFileSync(USERS_FILE, JSON.stringify(defaultUser));
    console.log("Varsayılan kullanıcı oluşturuldu: admin / admin123");
}

const readJson = (file) => JSON.parse(fs.readFileSync(file));
const writeJson = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// --- ROUTES ---
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const users = readJson(USERS_FILE);
    const user = users.find(u => u.username === username);
    if (user && bcrypt.compareSync(password, user.password)) {
        const token = jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token });
    } else {
        res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı' });
    }
});

app.get('/api/users', authenticateToken, (req, res) => {
    const users = readJson(USERS_FILE).map(u => ({ username: u.username }));
    res.json(users);
});

app.post('/api/users', authenticateToken, (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Eksik bilgi' });
    const users = readJson(USERS_FILE);
    if (users.find(u => u.username === username)) return res.status(409).json({ error: 'Kullanıcı zaten var' });
    const hashedPassword = bcrypt.hashSync(password, 10);
    users.push({ username, password: hashedPassword });
    writeJson(USERS_FILE, users);
    res.json({ message: 'Kullanıcı oluşturuldu' });
});

app.put('/api/users/:username', authenticateToken, (req, res) => {
    const { username } = req.params;
    const { newPassword } = req.body;
    let users = readJson(USERS_FILE);
    const userIndex = users.findIndex(u => u.username === username);
    if (userIndex === -1) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    users[userIndex].password = bcrypt.hashSync(newPassword, 10);
    writeJson(USERS_FILE, users);
    res.json({ message: 'Şifre güncellendi' });
});

app.delete('/api/users/:username', authenticateToken, (req, res) => {
    const { username } = req.params;
    let users = readJson(USERS_FILE);
    if (users.length <= 1) return res.status(400).json({ error: 'Son kullanıcı silinemez' });
    users = users.filter(u => u.username !== username);
    writeJson(USERS_FILE, users);
    res.json({ message: 'Kullanıcı silindi' });
});

app.get('/api/feed.xml', (req, res) => {
    const items = readJson(DB_FILE);
    const validItems = items.filter(item => {
        const isComplete = item.details.price && item.details.moldPrice;
        const userWantsInXml = item.inXml !== undefined ? item.inXml : true;
        return userWantsInXml && isComplete;
    });
    const root = xmlbuilder.create('products');
    validItems.forEach(item => {
        const prod = root.ele('product');
        prod.ele('id', item.stockCode);
        prod.ele('stock_code', item.stockCode);
        prod.ele('category', item.category || 'Genel');
        prod.ele('name', item.title);
        prod.ele('name_mold', `Silikon Kalıp ${item.title}`);
        prod.ele('price', item.details.price);
        prod.ele('stock_quantity', item.details.quantity || 0);
        prod.ele('mold_price', item.details.moldPrice);
        prod.ele('width', item.details.width);
        prod.ele('height', item.details.height);
        prod.ele('description', item.details.description);
        
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.get('host');
        const fullImageUrl = item.imageUrl.startsWith('http') 
            ? item.imageUrl 
            : `${protocol}://${host}${item.imageUrl}`;
        prod.ele('image', fullImageUrl);
    });
    const xml = root.end({ pretty: true });
    res.header('Content-Type', 'application/xml');
    res.send(xml);
});

const downloadImage = async (url, filepath) => {
    const response = await axios({
        url, method: 'GET', responseType: 'stream',
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36', 'Referer': 'https://www.instagram.com/' }
    });
    return new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(filepath);
        response.data.pipe(writer);
        let error = null;
        writer.on('error', err => { error = err; writer.close(); reject(err); });
        writer.on('close', () => { if (!error) resolve(true); });
    });
};

const processUrl = async (url, existingItems, category = 'Genel') => {
    if (!url) return null;
    if (existingItems.find(item => item.originalUrl === url)) return { error: 'Duplicate', url };
    try {
        let imageUrl = ''; let title = 'Yeni Ürün';
        if (url.match(/\.(jpeg|jpg|gif|png|webp)/i) != null) { imageUrl = url; title = 'Görsel Ürün'; } 
        else if (url.includes('instagram.com')) {
            const cleanImageUrl = url.split('?')[0].replace(/\/$/, "") + '/media/?size=l';
            try { const headCheck = await axios.head(cleanImageUrl); if (headCheck.status === 200) imageUrl = cleanImageUrl; } catch (e) { }
        }
        if (!imageUrl) {
            try { const options = { url: url }; const { result } = await ogs(options); title = result.ogTitle || 'Yeni Ürün';
                if (result.ogImage && result.ogImage.length > 0) imageUrl = result.ogImage[0].url;
            } catch (e) { }
        }
        if (!imageUrl) return { error: 'NoImage', url };
        let fileName = null; let finalImageUrl = imageUrl;
        try {
            const urlPath = imageUrl.split('?')[0]; const ext = path.extname(urlPath) || '.jpg';
            fileName = `${uuidv4()}${ext}`;
            const filePath = path.join(UPLOADS_DIR, fileName);
            await downloadImage(imageUrl, filePath);
            finalImageUrl = `/uploads/${fileName}`;
        } catch (downloadError) { finalImageUrl = imageUrl; }
        const stockCode = 'STK-' + Math.random().toString(36).substring(2, 7).toUpperCase();
        const newItem = { id: uuidv4(), stockCode: stockCode, inXml: true, category: category, originalUrl: url, imageUrl: finalImageUrl, title: title, details: { width: '', height: '', price: '', moldPrice: '', quantity: 1, description: '' }, createdAt: new Date().toISOString() };
        return { success: true, item: newItem };
    } catch (error) { return { error: 'Exception', url, msg: error.message }; }
};

app.get('/api/items', authenticateToken, (req, res) => res.json(readJson(DB_FILE)));
app.post('/api/items', authenticateToken, async (req, res) => {
    const { url, category } = req.body;
    const currentItems = readJson(DB_FILE);
    const result = await processUrl(url, currentItems, category);
    if (!result) return res.status(400).json({ error: 'Invalid URL' });
    if (result.error === 'Duplicate') return res.status(409).json({ error: 'Duplicate' });
    if (result.error) return res.status(500).json({ error: 'Error' });
    currentItems.unshift(result.item);
    writeJson(DB_FILE, currentItems);
    res.json(result.item);
});
app.post('/api/items/manual', authenticateToken, upload.single('image'), (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Resim dosyası gerekli.' });
        const { title, price, moldPrice, width, height, quantity, description, category } = req.body;
        const ext = path.extname(req.file.originalname) || '.jpg';
        const fileName = `${uuidv4()}${ext}`;
        const targetPath = path.join(UPLOADS_DIR, fileName);
        fs.renameSync(req.file.path, targetPath);
        const stockCode = 'STK-' + Math.random().toString(36).substring(2, 7).toUpperCase();
        const newItem = { id: uuidv4(), stockCode, inXml: true, category: category || 'Genel', originalUrl: 'manual_upload', imageUrl: `/uploads/${fileName}`, title: title || 'Manuel Ürün', details: { width, height, price, moldPrice, quantity: quantity || 1, description }, createdAt: new Date().toISOString() };
        const items = readJson(DB_FILE); items.unshift(newItem); writeJson(DB_FILE, items); res.json(newItem);
    } catch (error) { res.status(500).json({ error: 'Error' }); }
});
app.post('/api/upload-csv', authenticateToken, upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const results = [];
    fs.createReadStream(req.file.path).pipe(csv()).on('data', (data) => { const url = data.url || data.link || Object.values(data)[0]; if (url) results.push(url.trim()); }).on('end', async () => {
        fs.unlinkSync(req.file.path); const currentItems = readJson(DB_FILE); const newItems = []; let successCount = 0;
        for (const url of results) { const result = await processUrl(url, [...currentItems, ...newItems], 'Genel'); if (result && result.success) { newItems.push(result.item); successCount++; } }
        if (newItems.length > 0) writeJson(DB_FILE, [...newItems, ...currentItems]); res.json({ message: `Processed ${successCount}`, newItems });
    });
});
app.put('/api/items/:id', authenticateToken, (req, res) => {
    const { id } = req.params; const { details, title, category } = req.body; const items = readJson(DB_FILE); const itemIndex = items.findIndex(i => i.id === id); if (itemIndex === -1) return res.status(404).json({ error: 'Item not found' });
    if (details) items[itemIndex].details = { ...items[itemIndex].details, ...details }; if (title) items[itemIndex].title = title; if (category) items[itemIndex].category = category;
    writeJson(DB_FILE, items); res.json(items[itemIndex]);
});
app.patch('/api/items/:id/toggle-xml', authenticateToken, (req, res) => {
    const { id } = req.params; const { inXml } = req.body; const items = readJson(DB_FILE); const item = items.find(i => i.id === id); if (!item) return res.status(404).json({ error: 'Item not found' });
    item.inXml = inXml; writeJson(DB_FILE, items); res.json(item);
});
app.delete('/api/items/:id', authenticateToken, (req, res) => {
    const { id } = req.params; let items = readJson(DB_FILE); const itemIndex = items.findIndex(i => i.id === id); if (itemIndex === -1) return res.status(404).json({ error: 'Item not found' });
    const item = items[itemIndex]; if (item.imageUrl && item.imageUrl.startsWith('/uploads/')) { try { fs.unlinkSync(path.join(__dirname, item.imageUrl)); } catch(e) {} }
    items.splice(itemIndex, 1); writeJson(DB_FILE, items); res.json({ success: true });
});
app.get('/api/categories', authenticateToken, (req, res) => res.json(readJson(CATEGORIES_FILE)));
app.post('/api/categories', authenticateToken, (req, res) => { const { name } = req.body; const categories = readJson(CATEGORIES_FILE); if (!categories.includes(name)) { categories.push(name); writeJson(CATEGORIES_FILE, categories); } res.json(categories); });
app.delete('/api/categories/:name', authenticateToken, (req, res) => { const { name } = req.params; let categories = readJson(CATEGORIES_FILE); categories = categories.filter(c => c !== name); writeJson(CATEGORIES_FILE, categories); res.json(categories); });

app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });

app.listen(PORT, '0.0.0.0', () => { console.log(`Server running on port ${PORT}`); });
