const { execSync } = require('child_process');

// Автоматическая проверка и установка зависимостей перед запуском сервера
function installModules() {
    const requiredModules = ['express', 'multer', 'cors'];
    let statusChanged = false;

    requiredModules.forEach(mod => {
        try {
            require.resolve(mod);
        } catch (e) {
            console.log(`[Авто-установка] Модуль "${mod}" не найден. Устанавливаем...`);
            execSync(`npm install ${mod}`, { stdio: 'inherit' });
            statusChanged = true;
        }
    });

    if (statusChanged) {
        console.log('[Авто-установка] Все модули успешно установлены!\n');
    }
}

// Запускаем проверку модулей
installModules();

// Основной код сервера запускается только после успешной проверки
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;
const DB_FILE = path.join(__dirname, 'news.json');

app.use(cors());
app.use(express.json());

app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

if (!fs.existsSync('./uploads')) {
    fs.mkdirSync('./uploads');
}

// Функция чтения из JSON-файла
function readNewsFromFile() {
    try {
        if (!fs.existsSync(DB_FILE)) {
            fs.writeFileSync(DB_FILE, JSON.stringify([]));
            return [];
        }
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data || '[]');
    } catch (err) {
        console.error("Ошибка чтения файла базы данных:", err);
        return [];
    }
}

// Функция записи в JSON-файл
function writeNewsToFile(newsList) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(newsList, null, 2), 'utf8');
    } catch (err) {
        console.error("Ошибка записи в файл базы данных:", err);
    }
}

// Конфигурация хранилища картинок
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// API: Получить новости
app.get('/api/news', (req, res) => {
    const newsList = readNewsFromFile();
    res.json(newsList);
});

// API: Добавить новость
app.post('/api/news', upload.single('imageFile'), (req, res) => {
    const { title, author, desc } = req.body;
    const newsList = readNewsFromFile();
    
    let imageUrl = '';
    if (req.file) {
        imageUrl = `http://localhost:${PORT}/uploads/${req.file.filename}`;
    }

    const currentDate = new Date().toLocaleDateString('ru-RU', {
        day: 'numeric', month: 'long', year: 'numeric'
    });

    const newNews = {
        id: Date.now(),
        title,
        author,
        desc,
        image: imageUrl,
        date: currentDate
    };

    newsList.unshift(newNews);
    writeNewsToFile(newsList);
    
    res.status(201).json(newNews);
});

// API: Удалить новость
app.delete('/api/news/:id', (req, res) => {
    const id = parseInt(req.params.id);
    let newsList = readNewsFromFile();
    
    // Поиск новости для удаления физического файла картинки с диска
    const targetNews = newsList.find(item => item.id === id);
    if (targetNews && targetNews.image) {
        try {
            const filename = targetNews.image.split('/uploads/')[1];
            const filePath = path.join(__dirname, 'uploads', filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (err) {
            console.error("Не удалось удалить файл изображения:", err);
        }
    }
    
    newsList = newsList.filter(item => item.id !== id);
    writeNewsToFile(newsList);
    
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`\n==================================================`);
    console.log(`Сервер запущен! База данных подключена.`);
    console.log(`Откройте в браузере: http://localhost:${PORT}`);
    console.log(`==================================================`);
});

