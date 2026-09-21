import { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';

const media = [
  {
    title: 'Dune: Part Two',
    type: 'Movie',
    year: '2024',
    duration: '2h 46m',
    progress: 62,
    size: '18.4 GB',
    quality: '4K HDR',
    image: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=900&q=85',
  },
  {
    title: 'The Bear',
    type: 'Series',
    year: '2023',
    duration: 'S02 E03',
    progress: 31,
    size: '3.8 GB',
    quality: '1080p',
    image: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=700&q=85',
  },
  {
    title: 'Oppenheimer',
    type: 'Movie',
    year: '2023',
    duration: '3h 00m',
    progress: 0,
    size: '12.1 GB',
    quality: '4K HDR',
    image: 'https://images.unsplash.com/photo-1516339901601-2e1b62dc0c45?auto=format&fit=crop&w=700&q=85',
  },
  {
    title: 'Spider-Man: Across the Spider-Verse',
    type: 'Movie',
    year: '2023',
    duration: '2h 20m',
    progress: 0,
    size: '8.6 GB',
    quality: '1080p',
    image: 'https://images.unsplash.com/photo-1534791547706-9e0e5b7e5f3f?auto=format&fit=crop&w=700&q=85',
  },
];

const mediaDatabase = 'flicker-media';
const mediaStore = 'downloads';

const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / (1024 ** unitIndex);
  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
};

const openMediaDatabase = () => new Promise((resolve, reject) => {
  if (!window.indexedDB) {
    reject(new Error('IndexedDB is not available'));
    return;
  }
  const request = window.indexedDB.open(mediaDatabase, 1);
  request.onupgradeneeded = () => request.result.createObjectStore(mediaStore, { keyPath: 'id' });
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const readDownloads = async () => {
  const database = await openMediaDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(mediaStore, 'readonly').objectStore(mediaStore).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const saveDownload = async (item) => {
  const database = await openMediaDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(mediaStore, 'readwrite').objectStore(mediaStore).put(item);
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });
};

const removeDownload = async (id) => {
  const database = await openMediaDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(mediaStore, 'readwrite').objectStore(mediaStore).delete(id);
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });
};

function App() {
  const [activeNav, setActiveNav] = useState('Library');
  const [downloads, setDownloads] = useState([]);
  const [selected, setSelected] = useState(media[0]);
  const [query, setQuery] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [filter, setFilter] = useState('All media');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [openMenu, setOpenMenu] = useState(null);
  const [notice, setNotice] = useState('');
  const [storageQuota, setStorageQuota] = useState(1.2 * 1024 ** 4);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const localUrlsRef = useRef([]);
  const downloadsChangedRef = useRef(false);

  const libraryMedia = useMemo(() => [...downloads, ...media], [downloads]);
  const storageUsed = useMemo(() => downloads.reduce((total, item) => total + (item.blob?.size || 0), 0), [downloads]);
  const storagePercent = Math.min(100, Math.round((storageUsed / storageQuota) * 100));

  useEffect(() => {
    navigator.storage?.estimate?.().then(({ quota }) => {
      if (quota) setStorageQuota(quota);
    }).catch(() => {});
  }, [downloads]);

  const pauseVideo = () => {
    if (navigator.userAgent.includes('jsdom')) return;
    try {
      videoRef.current?.pause();
    } catch {}
  };

  const filteredMedia = useMemo(() => libraryMedia.filter((item) => {
    const matchesQuery = item.title.toLowerCase().includes(query.toLowerCase());
    const matchesFilter = filter === 'All media' || item.type === filter;
    return matchesQuery && matchesFilter;
  }), [filter, libraryMedia, query]);

  useEffect(() => {
    let cancelled = false;
    readDownloads().then((storedDownloads) => {
      if (cancelled || downloadsChangedRef.current) return;
      const restoredDownloads = storedDownloads.map((item) => {
        const videoUrl = URL.createObjectURL(item.blob);
        localUrlsRef.current.push(videoUrl);
        return { ...item, videoUrl, isLocal: true };
      });
      setDownloads(restoredDownloads);
    }).catch(() => {});

    return () => {
      cancelled = true;
      localUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(document.fullscreenElement === playerRef.current);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const handleSeekKey = (event) => {
      if (!selected.videoUrl || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      const key = event.key.toLowerCase();
      if (key === 'f') {
        event.preventDefault();
        setIsMuted((muted) => !muted);
        return;
      }
      if (key !== 'a' && key !== 'd' || !videoRef.current) return;
      event.preventDefault();
      const video = videoRef.current;
      const nextTime = video.currentTime + (key === 'd' ? 10 : -10);
      video.currentTime = Math.max(0, Math.min(nextTime, Number.isFinite(video.duration) ? video.duration : nextTime));
    };

    window.addEventListener('keydown', handleSeekKey);
    return () => window.removeEventListener('keydown', handleSeekKey);
  }, [selected.videoUrl]);

  const selectMedia = (item) => {
    pauseVideo();
    setSelected(item);
    setIsPlaying(false);
    setIsMuted(false);
    setOpenMenu(null);
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || (file.type !== 'video/mp4' && !file.name.toLowerCase().endsWith('.mp4'))) return;

    const videoUrl = URL.createObjectURL(file);
    localUrlsRef.current.push(videoUrl);
    const localItem = {
      id: `${file.name}-${file.lastModified}-${file.size}`,
      title: file.name.replace(/\.mp4$/i, ''),
      type: 'Movie',
      year: 'Local file',
      duration: 'MP4 video',
      progress: 0,
      size: `${(file.size / (1024 * 1024 * 1024)).toFixed(1)} GB`,
      quality: 'Local',
      image: media[0].image,
      blob: file,
      videoUrl,
      isLocal: true,
    };
    const storedItem = { ...localItem, blob: file };
    delete storedItem.videoUrl;
    saveDownload(storedItem).catch(() => {});
    downloadsChangedRef.current = true;
    setDownloads((items) => [localItem, ...items.filter((item) => item.id !== localItem.id)]);
    setSelected(localItem);
    setIsPlaying(false);
    setIsMuted(false);
  };

  const togglePlayback = () => {
    if (selected.videoUrl && videoRef.current) {
      if (videoRef.current.paused) videoRef.current.play();
      else videoRef.current.pause();
      return;
    }
    setIsPlaying((playing) => !playing);
  };

  const toggleMute = () => setIsMuted((muted) => !muted);

  const toggleFullscreen = async () => {
    if (!selected.videoUrl || !playerRef.current) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await playerRef.current.requestFullscreen();
    }
  };

  const showNotice = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2200);
  };

  const renameMedia = async (item) => {
    if (!item.isLocal) {
      showNotice('Only downloaded files can be renamed.');
      return;
    }
    const nextTitle = window.prompt('Rename media', item.title)?.trim();
    if (!nextTitle || nextTitle === item.title) return;
    const renamed = { ...item, title: nextTitle };
    downloadsChangedRef.current = true;
    const storedItem = { ...renamed, blob: item.blob };
    delete storedItem.videoUrl;
    await saveDownload(storedItem).catch(() => {});
    setDownloads((items) => items.map((download) => download.id === item.id ? renamed : download));
    setSelected((current) => current.id === item.id ? renamed : current);
    showNotice('Media renamed.');
  };

  const deleteMedia = async (item) => {
    const isSavedDownload = item.isLocal || downloads.some((download) => download.id === item.id || download.title === item.title);
    if (!isSavedDownload) {
      showNotice('Built-in library media cannot be deleted.');
      return;
    }
    downloadsChangedRef.current = true;
    if (item.videoUrl) {
      URL.revokeObjectURL(item.videoUrl);
      localUrlsRef.current = localUrlsRef.current.filter((url) => url !== item.videoUrl);
    }
    removeDownload(item.id).catch(() => {});
    setDownloads((items) => items.filter((download) => download.id !== item.id && download.title !== item.title));
    pauseVideo();
    setSelected(media[0]);
    setIsPlaying(false);
    setOpenMenu(null);
    showNotice('Media deleted from Downloads.');
  };

  const shareMedia = async (item) => {
    const shareData = { title: item.title, text: `${item.title} is in my Flicker library.` };
    if (navigator.share) {
      await navigator.share(shareData).catch(() => {});
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(shareData.text).catch(() => {});
      showNotice('Share text copied to clipboard.');
    } else {
      showNotice('Sharing is not available in this browser.');
    }
    setOpenMenu(null);
  };

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">F</span><span>Flicker</span></div>
        <nav className="nav-list" aria-label="Main navigation">
          {['Library', 'Downloads', 'Collections'].map((item) => (
            <button className={`nav-item ${activeNav === item ? 'active' : ''}`} key={item} onClick={() => setActiveNav(item)}>
              <span className="nav-icon">{item === 'Library' ? '▦' : item === 'Downloads' ? '↓' : '▤'}</span>{item}
              {item === 'Downloads' && <span className="nav-count">{downloads.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="storage-label"><span>Storage</span><strong>{storagePercent}%</strong></div>
          <div className="storage-track"><span style={{ width: `${storagePercent}%` }} /></div>
          <p className="storage-copy">{formatBytes(storageUsed)} of {formatBytes(storageQuota)} used</p>
          <button className="settings-button"><span>⚙</span> Settings</button>
          <div className="profile"><div className="avatar">JD</div><div><strong>Jordan Davis</strong><small>Local library</small></div><span className="more">•••</span></div>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div><p className="eyebrow">{activeNav}</p><h1>{activeNav === 'Downloads' ? 'Downloads' : 'Your library'}</h1></div>
          <div className="top-actions">
            <label className="search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your library" aria-label="Search your library" /></label>
            <button className="icon-button" aria-label="Notifications">♢<i /></button>
            <button className="add-button" onClick={() => fileInputRef.current?.click()}><span>+</span> Add media</button>
            <input ref={fileInputRef} className="file-input" type="file" accept="video/mp4,.mp4" onChange={handleFileChange} aria-label="Choose an MP4 video" />
          </div>
        </header>

        <section ref={playerRef} className={`hero ${selected.isLocal ? 'local-hero' : ''} ${isFullscreen ? 'is-fullscreen' : ''}`} style={{ backgroundImage: `linear-gradient(90deg, rgba(13, 18, 27, .98) 0%, rgba(13, 18, 27, .86) 38%, rgba(13, 18, 27, .16) 100%), url(${selected.image})` }}>
          {selected.videoUrl && <video ref={videoRef} className="hero-video" src={selected.videoUrl} muted={isMuted} preload="metadata" onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onEnded={() => setIsPlaying(false)} />}
          <div className="hero-copy">
            <span className="now-playing">{isPlaying ? 'Now playing' : 'Continue watching'}</span>
            <h2>{selected.title}</h2>
            <p className="hero-meta">{selected.year} <span /> {selected.type} <span /> {selected.quality}</p>
            <p className="hero-description">{selected.isLocal ? 'A local MP4 from your computer, ready to watch in the browser.' : 'A downloaded favorite, ready when you are. Pick up where you left off with your local collection.'}</p>
            <div className="hero-actions"><button className="play-button" aria-label={isPlaying ? `Pause ${selected.title}` : `Play ${selected.title}`} aria-pressed={isPlaying} onClick={togglePlayback}><span>{isPlaying ? 'Ⅱ' : '▶'}</span>{isPlaying ? 'Pause' : 'Play now'}</button><button className="subtle-button" onClick={() => setSelected(media[0])}>＋ Add to queue</button></div>
          </div>
          <div className="hero-footer"><button className="watch-control" aria-label={isPlaying ? `Pause ${selected.title}` : `Play ${selected.title}`} onClick={togglePlayback}>{isPlaying ? 'Ⅱ' : '▶'}</button>{selected.videoUrl && <button className="watch-control audio-control" aria-label={isMuted ? `Unmute ${selected.title}` : `Mute ${selected.title}`} aria-pressed={isMuted} onClick={toggleMute}>{isMuted ? '🔇' : '🔊'}</button>}<span>{selected.progress ? `${selected.progress}% watched` : 'Ready to watch'}</span><div className="progress-bar"><span style={{ width: `${selected.progress || 4}%` }} /></div><span>{selected.duration}</span>{selected.videoUrl && <button className="fullscreen-control" aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} onClick={toggleFullscreen}>{isFullscreen ? '⛶' : '⛶'}</button>}</div>
          {isPlaying && <div className="playing-badge">Playing locally</div>}
        </section>

        <div className="section-heading"><div><h2>{activeNav === 'Downloads' ? 'Saved on this device' : 'Recently added'}</h2><p>{activeNav === 'Downloads' ? `${downloads.length} local MP4${downloads.length === 1 ? '' : 's'} saved` : `${filteredMedia.length} titles in your library`}</p></div>{activeNav !== 'Downloads' && <div className="filters">{['All media', 'Movie', 'Series'].map((item) => <button className={filter === item ? 'selected' : ''} key={item} onClick={() => setFilter(item)}>{item === 'Movie' ? 'Movies' : item === 'Series' ? 'Series' : item}</button>)}</div>}</div>
        {activeNav === 'Downloads' && downloads.length === 0 ? <div className="empty-downloads"><span className="empty-icon">↓</span><h2>No downloads yet</h2><p>Choose an MP4 from your computer to keep it available here.</p><button className="add-button" onClick={() => fileInputRef.current?.click()}><span>+</span> Add an MP4</button></div> : <section className="media-grid" aria-label={activeNav === 'Downloads' ? 'Downloaded media' : 'Recently added media'}>
          {(activeNav === 'Downloads' ? downloads : filteredMedia).map((item) => <div className={`media-card ${selected.title === item.title ? 'selected-card' : ''}`} key={item.id || item.title} role="button" tabIndex="0" onClick={() => selectMedia(item)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') selectMedia(item); }}><div className="poster"><img src={item.image} alt="" /><span className="quality-tag">{item.quality}</span>{item.progress > 0 && <span className="card-progress"><span style={{ width: `${item.progress}%` }} /></span>}</div><div className="card-info"><div><h3>{item.title}</h3><p>{item.year} · {item.type}</p></div><div className="card-actions"><button className="card-menu" aria-label={`Open menu for ${item.title}`} onClick={(event) => { event.stopPropagation(); setOpenMenu(openMenu === (item.id || item.title) ? null : (item.id || item.title)); }}>•••</button>{openMenu === (item.id || item.title) && <div className="media-menu" role="menu"><button role="menuitem" onClick={(event) => { event.stopPropagation(); renameMedia(item); setOpenMenu(null); }}>Rename</button><button role="menuitem" onClick={(event) => { event.stopPropagation(); shareMedia(item); }}>Share</button><button role="menuitem" onClick={(event) => { event.stopPropagation(); showNotice(`${item.title} · ${item.size} · ${item.quality}`); setOpenMenu(null); }}>Details</button><button role="menuitem" onClick={(event) => { event.stopPropagation(); deleteMedia(item); }}>Delete</button></div>}</div></div></div>)}
        </section>}
        {notice && <div className="toast" role="status">{notice}</div>}
      </section>
    </main>
  );
}

export default App;
