const MODELS = [
    {
        name: 'Rig Mob Minecraft',
        caption: 'Rig Mob Minecraft not full it\'s free.',
        creator: '',
        converter: 'alisastro123',
        category: ['Minecraft', 'Rig', 'Mob', 'Free'], 
        thumb: 'https://i.postimg.cc/2qbcjDVp/thumbnail1.png',
        link: 'https://www.mediafire.com/file/ynm849b3g243pnc/Mob_Minecraft_Full.zip/file'
    },
    {
       name: 'Hospital Furniture',
        caption: 'Content hospital pack models',
        creator: '',
        converter: 'IanAdhi',
        category: ['Minecraft', 'Furniture', 'Model'], 
        thumb: 'https://i.postimg.cc/qRPx1WBq/Hospital_Pack_Models.jpg',
        link: 'https://www.mediafire.com/file/xblgnyiy5hnsnk1/Hospital_Furniture_.zip/file'
     },
     {
       name: 'Classroom Map',
        caption: 'Classroom contains classroom',
        creator: 'IanAdhi & RidwanMC',
        converter: '',
        category: ['Minecraft', 'Map', 'Model', 'Aesthetic'], 
        thumb: 'https://i.postimg.cc/QNzbt9pj/Classroom_Map.jpg',
        link: 'https://www.mediafire.com/file/ou1x7ukjqwbfqwz/Classroom_Map_%252B_Furniture.zip/file'
      },
     {
       name: 'Classroom Pack',
        caption: 'Containts Classroom Pack Models',
        creator: 'IanAdhi',
        converter: '',
        category: ['Minecraft', 'Furniture', 'Model-pack'], 
        thumb: 'https://i.postimg.cc/9MKJvrbd/Classroom_Pack.jpg',
        link: 'https://www.mediafire.com/file/2jyagccxhuqx9j6/Classroom_Pack.zip/file'
     },  
     {
       name: 'Sofa Royal Furniture',
        caption: 'Containts sofa Royal models',
        creator: '',
        converter: 'IanAdhi',
        category: ['Royal', 'Furniture', 'Aesthetic', 'ModelsPack'], 
        thumb: 'https://i.postimg.cc/yxhcvdbY/Sofa_Royal_Packs.jpg',
        link: 'https://www.mediafire.com/file/vwdirybg8l2fxjl/Sofa_Royal_Furniture.zip/file'
     },
       {
       name: 'Valentine Packs',
        caption: 'Containts Valentine Pack Models',
        creator: '',
        converter: 'IanAdhi',
        category: ['Cosmetic', 'Furniture', 'Model-pack', 'Items'], 
        thumb: 'https://i.postimg.cc/rmXD3TW6/Valentine_Pack_models.jpg',
        link: 'https://www.mediafire.com/file/vou12hl26d3l0n1/Valentine_Pack.zip/file'
     },
     {
       name: 'Rig Afi V2',
        caption: 'Containts Valentine Pack Models',
        creator: 'IanAdhi',
        converter: '',
        category: ['Rig-Model', 'Ava', 'Model', 'Prisma3D'], 
        thumb: 'https://i.postimg.cc/hGVw881w/Afi_Rig_V2.jpg',
        link: 'https://youtu.be/8G6r_OuBpUw?si=ymUXbGYA0t_Hl9nO'
     }
];

const ACCENTS = ['#00d4aa', '#6366f1', '#47115C', '#0A9BCA', '#FBC531', '#EE6384', '#186748'];
let currentModel = null, currentTheme = 'light', currentAccent = '#00d4aa';

function renderModels(filter = '') {
    const grid = document.getElementById('content-grid');
    const filtered = MODELS.filter(m => {
        const s = filter.toLowerCase();
        const c = Array.isArray(m.category) ? m.category.join(' ').toLowerCase() : m.category.toLowerCase();
        return m.name.toLowerCase().includes(s) || c.includes(s) || m.converter.toLowerCase().includes(s) || m.creator.toLowerCase().includes(s);
    });

    grid.innerHTML = filtered.map(model => `
        <article class="model-card" onclick="openModal(${MODELS.indexOf(model)})">
            <img src="${model.thumb}" class="card-image" loading="lazy">
            <div class="card-content">
                <div class="card-title">${model.name}</div>
                <div class="card-caption">${model.caption}</div>
            </div>
        </article>
    `).join('');
    lucide.createIcons();
}

function openModal(index) {
    currentModel = MODELS[index];
    const infoBox = document.getElementById('info-container');
    document.getElementById('modal-thumb').src = currentModel.thumb;
    document.getElementById('modal-title').textContent = currentModel.name;
    document.getElementById('modal-caption').textContent = currentModel.caption;
    
    let infoHtml = '';
    if(currentModel.creator) infoHtml += `<div class="flex justify-between"><span>Creator:</span><b>${currentModel.creator}</b></div>`;
    if(currentModel.converter) infoHtml += `<div class="flex justify-between"><span>Converter:</span><b>${currentModel.converter}</b></div>`;
    
    if(currentModel.category) {
        const catText = Array.isArray(currentModel.category) ? currentModel.category.join(', ') : currentModel.category;
        infoHtml += `<div class="flex justify-between"><span>Category:</span><b>${catText}</b></div>`;
    }

    infoBox.innerHTML = infoHtml;
    document.getElementById('modal-overlay').classList.add('active');
}

function closeModal() { document.getElementById('modal-overlay').classList.remove('active'); }
function toggleSettings() { document.getElementById('settings-panel').classList.toggle('open'); }
function openEventModal() { document.getElementById('event-overlay').classList.add('active'); }
function closeEventModal() { document.getElementById('event-overlay').classList.remove('active'); }

function setTheme(theme) {
    currentTheme = theme;
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.getElementById('theme-light').style.borderColor = theme === 'light' ? currentAccent : 'var(--border)';
    document.getElementById('theme-dark').style.borderColor = theme === 'dark' ? currentAccent : 'var(--border)';
}

function setAccent(color) {
    currentAccent = color;
    document.documentElement.style.setProperty('--accent', color);
    document.querySelectorAll('.accent-dot').forEach(dot => dot.classList.toggle('active', dot.dataset.color === color));
    setTheme(currentTheme);
}

function handleDownload() { window.open(currentModel.link, '_blank'); }
function handleCopyLink() {
    navigator.clipboard.writeText(currentModel.link).then(() => {
        const t = document.getElementById('toast');
        t.classList.remove('translate-y-20');
        setTimeout(() => t.classList.add('translate-y-20'), 2000);
    });
}

document.getElementById('search-input').addEventListener('input', (e) => renderModels(e.target.value));
document.getElementById('settings-btn').addEventListener('click', toggleSettings);

(function init() {
    const container = document.getElementById('accent-dots');
    ACCENTS.forEach(color => {
        const dot = document.createElement('div');
        dot.className = 'accent-dot';
        dot.dataset.color = color;
        dot.style.background = color;
        dot.onclick = () => setAccent(color);
        container.appendChild(dot);
    });
    renderModels();
    setTheme('light');
    lucide.createIcons();
})();
