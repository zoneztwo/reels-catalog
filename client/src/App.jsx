import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import { Container, Row, Col, Card, Button, Form, Modal, Spinner, InputGroup, Alert, Pagination, Badge } from 'react-bootstrap';
import { FaPlus, FaTrash, FaSearch, FaCube, FaTag, FaLayerGroup, FaFileUpload, FaRss, FaCheckCircle, FaTimesCircle, FaBoxOpen, FaFilter, FaCalendarAlt, FaEdit, FaImage, FaMousePointer, FaChevronDown, FaLock, FaUser, FaUsers, FaKey } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';

// --- AUTH CONFIG ---
const setAuthToken = (token) => {
    if (token) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
        delete axios.defaults.headers.common['Authorization'];
    }
};

// --- LOGIN COMPONENT ---
const LoginScreen = ({ onLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await axios.post('/api/login', { username, password });
            onLogin(res.data.token);
        } catch (err) {
            setError('Giriş başarısız. Bilgileri kontrol edin.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Container className="d-flex align-items-center justify-content-center vh-100">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                <Card className="modern-card p-4 shadow-lg border-0" style={{ width: '400px' }}>
                    <div className="text-center mb-4">
                        <h2 className="fw-bold text-white mb-1"><span style={{ color: '#6c5ce7' }}>Pro</span>Katalog</h2>
                        <p className="text-muted small">Yönetici Girişi</p>
                    </div>
                    <Form onSubmit={handleSubmit}>
                        <InputGroup className="mb-3">
                            <InputGroup.Text className="bg-dark border-secondary text-secondary"><FaUser /></InputGroup.Text>
                            <Form.Control 
                                className="modern-input border-secondary" 
                                placeholder="Kullanıcı Adı"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                            />
                        </InputGroup>
                        <InputGroup className="mb-4">
                            <InputGroup.Text className="bg-dark border-secondary text-secondary"><FaLock /></InputGroup.Text>
                            <Form.Control 
                                type="password"
                                className="modern-input border-secondary" 
                                placeholder="Şifre"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </InputGroup>
                        {error && <Alert variant="danger" className="py-2 text-center small">{error}</Alert>}
                        <Button type="submit" variant="primary" className="modern-btn w-100" disabled={loading}>
                            {loading ? <Spinner size="sm" animation="border" /> : 'Giriş Yap'}
                        </Button>
                    </Form>
                </Card>
            </motion.div>
        </Container>
    );
};

// --- CATEGORY INPUT COMPONENT ---
const CategoryInput = ({ value, onChange, categories, onAddCategory }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [filterText, setFilterText] = useState('');
    const wrapperRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setIsOpen(false);
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    useEffect(() => { setFilterText(value); }, [value]);

    const filteredCategories = categories.filter(c => c.toLowerCase().includes(filterText.toLowerCase()));
    const exactMatch = categories.some(c => c.toLowerCase() === filterText.toLowerCase());

    const handleSelect = (cat) => { onChange(cat); setFilterText(cat); setIsOpen(false); };
    const handleAddNew = () => { onAddCategory(filterText); onChange(filterText); setIsOpen(false); };

    return (
        <div ref={wrapperRef} className="position-relative w-100">
            <div className="position-relative">
                <Form.Control
                    className="modern-input"
                    placeholder="Kategori seç veya yaz..."
                    value={filterText}
                    onChange={(e) => { setFilterText(e.target.value); onChange(e.target.value); setIsOpen(true); }}
                    onFocus={() => setIsOpen(true)}
                    style={{ paddingRight: '30px' }}
                />
                <FaChevronDown className="position-absolute top-50 end-0 translate-middle-y me-3 text-secondary" style={{ pointerEvents: 'none' }} />
            </div>
            {isOpen && (
                <div className="position-absolute w-100 mt-1 rounded shadow-lg overflow-hidden" style={{ zIndex: 1050, background: '#1e1e1e', border: '1px solid rgba(255,255,255,0.1)', maxHeight: '200px', overflowY: 'auto' }}>
                    {filteredCategories.map(cat => (
                        <div key={cat} className="p-2 cursor-pointer border-bottom border-secondary border-opacity-25 text-white-50" onClick={() => handleSelect(cat)} onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.05)'} onMouseLeave={(e) => e.target.style.background = 'transparent'}>{cat}</div>
                    ))}
                    {!exactMatch && filterText.trim() !== '' && (
                        <div className="p-2 cursor-pointer text-success fw-bold" style={{ background: 'rgba(0, 184, 148, 0.1)' }} onClick={handleAddNew}><FaPlus className="me-2"/> "{filterText}" Ekle</div>
                    )}
                </div>
            )}
        </div>
    );
};

// --- MAIN APP ---
function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  
  // App States
  const [items, setItems] = useState([]);
  const [users, setUsers] = useState([]); // Kullanıcılar
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [csvLoading, setCsvLoading] = useState(false);
  const [manualLoading, setManualLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  const [selectedItem, setSelectedItem] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false); // Kullanıcı Modalı

  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('Genel');
  const [newCategoryName, setNewCategoryName] = useState('');

  // User Mgmt State
  const [newUser, setNewUser] = useState('');
  const [newPass, setNewPass] = useState('');
  const [changePassUser, setChangePassUser] = useState(null); // Şifresi değişecek user
  const [changePassVal, setChangePassVal] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 24;

  const fileInputRef = useRef(null);
  const manualFileInputRef = useRef(null);
  
  const [editDetails, setEditDetails] = useState({ width: '', height: '', price: '', moldPrice: '', quantity: '', description: '' });
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState('Genel');

  const [manualForm, setManualForm] = useState({ title: '', price: '', moldPrice: '', quantity: '1', width: '', height: '', description: '', image: null, category: 'Genel' });

  // Init Auth
  useEffect(() => {
      if (token) {
          setAuthToken(token);
          fetchItems();
          fetchCategories();
      }
  }, [token]);

  const handleLogin = (newToken) => {
      localStorage.setItem('token', newToken);
      setToken(newToken);
  };

  const handleLogout = () => {
      localStorage.removeItem('token');
      setToken(null);
      setItems([]);
  };

  const fetchCategories = async () => {
      try { const res = await axios.get('/api/categories'); setCategories(res.data); } catch (err) { console.error(err); }
  };

  const fetchUsers = async () => {
      try { const res = await axios.get('/api/users'); setUsers(res.data); } catch (err) { console.error(err); }
  };

  const handleAddUser = async () => {
      if (!newUser || !newPass) return alert("Kullanıcı adı ve şifre gerekli");
      try { await axios.post('/api/users', { username: newUser, password: newPass }); fetchUsers(); setNewUser(''); setNewPass(''); } catch(e) { alert("Hata veya kullanıcı zaten var"); }
  };

  const handleDeleteUser = async (username) => {
      if (!window.confirm("Kullanıcı silinsin mi?")) return;
      try { await axios.delete(`/api/users/${username}`); fetchUsers(); } catch(e) { alert("Hata: Son kullanıcı silinemez."); }
  };

  const handleChangePassword = async () => {
      if (!changePassVal) return;
      try { await axios.put(`/api/users/${changePassUser}`, { newPassword: changePassVal }); alert("Şifre güncellendi"); setChangePassUser(null); setChangePassVal(''); } catch(e) { alert("Hata"); }
  };

  const handleAddCategory = async (nameToAdd) => {
      const name = nameToAdd || newCategoryName; 
      if (!name) return;
      try { const res = await axios.post('/api/categories', { name }); setCategories(res.data); if (!nameToAdd) setNewCategoryName(''); } catch (err) { alert('Hata'); }
  };

  const handleDeleteCategory = async (name) => {
      if (!window.confirm("Silinsin mi?")) return;
      try { const res = await axios.delete(`/api/categories/${name}`); setCategories(res.data); } catch (err) { alert('Hata'); }
  };

  const fetchItems = async () => {
    try { const res = await axios.get('/api/items'); setItems(res.data); } catch (err) { 
        if (err.response && err.response.status === 403) handleLogout(); // Token expired
    }
  };

  const filteredItems = useMemo(() => {
      let result = items;
      if (searchTerm) {
          const lowerTerm = searchTerm.toLowerCase();
          result = result.filter(item => (item.title?.toLowerCase().includes(lowerTerm)) || (item.stockCode?.toLowerCase().includes(lowerTerm)));
      }
      if (filterType !== 'all') {
          if (filterType === 'incomplete') result = result.filter(item => !item.details.price || !item.details.moldPrice);
          else if (filterType === 'in_xml') result = result.filter(item => (item.inXml ?? true) && item.details.price && item.details.moldPrice);
          else if (filterType === 'no_stock') result = result.filter(item => !item.details.quantity || parseInt(item.details.quantity) <= 0);
      }
      return result;
  }, [items, searchTerm, filterType]);

  const currentItems = useMemo(() => {
      const indexOfLast = currentPage * itemsPerPage;
      const indexOfFirst = indexOfLast - itemsPerPage;
      return filteredItems.slice(indexOfFirst, indexOfLast);
  }, [filteredItems, currentPage]);

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  useEffect(() => { setCurrentPage(1); }, [searchTerm, filterType]);

  // Handlers (Simplified for brevity, logic same as before)
  const handleAddItem = async (e) => {
    e.preventDefault(); if (!url) return;
    setLoading(true); setErrorMsg(''); setSuccessMsg('');
    try {
      const res = await axios.post('/api/items', { url, category: selectedCategory });
      setItems([res.data, ...items]); setUrl(''); setSuccessMsg('Eklendi.');
    } catch (err) { setErrorMsg('Hata.'); } finally { setLoading(false); }
  };

  const handleCsvUpload = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      const formData = new FormData(); formData.append('file', file);
      setCsvLoading(true); setErrorMsg('');
      try { await axios.post('/api/upload-csv', formData, { headers: { 'Content-Type': 'multipart/form-data' } }); fetchItems(); setSuccessMsg('Tamamlandı.'); } catch (err) { setErrorMsg('Hata.'); } finally { setCsvLoading(false); e.target.value=''; }
  };

  const handleManualSubmit = async () => {
      if (!manualForm.image || !manualForm.title) { alert("Eksik bilgi."); return; }
      const formData = new FormData();
      Object.keys(manualForm).forEach(key => formData.append(key, manualForm[key]));
      setManualLoading(true);
      try {
          const res = await axios.post('/api/items/manual', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
          setItems([res.data, ...items]); setShowManualModal(false); setSuccessMsg('Eklendi.');
          setManualForm({ title: '', price: '', moldPrice: '', quantity: '1', width: '', height: '', description: '', image: null, category: 'Genel' });
      } catch (err) { alert('Hata.'); } finally { setManualLoading(false); }
  };

  const toggleXmlStatus = async (e, item) => {
      e.stopPropagation();
      const newStatus = !(item.inXml ?? true);
      try { await axios.patch(`/api/items/${item.id}/toggle-xml`, { inXml: newStatus }); setItems(items.map(i => i.id === item.id ? { ...i, inXml: newStatus } : i)); } catch (err) { console.error(err); }
  };

  const openXmlFeed = () => window.open('/api/feed.xml', '_blank');

  const openItem = (item) => {
    setSelectedItem(item); setEditTitle(item.title || ''); setEditCategory(item.category || 'Genel');
    setEditDetails({ width: item.details?.width||'', height: item.details?.height||'', price: item.details?.price||'', moldPrice: item.details?.moldPrice||'', quantity: item.details?.quantity||0, description: item.details?.description||'' });
    setShowModal(true);
  };

  const handleSaveDetails = async () => {
    if (!selectedItem) return;
    try { const res = await axios.put(`/api/items/${selectedItem.id}`, { details: editDetails, title: editTitle, category: editCategory }); setItems(items.map(item => item.id === selectedItem.id ? res.data : item)); setShowModal(false); } catch (err) { alert("Hata."); }
  };

  const handleDelete = async () => {
      if (!selectedItem || !window.confirm("Silinsin mi?")) return;
      try { await axios.delete(`/api/items/${selectedItem.id}`); setItems(items.filter(i => i.id !== selectedItem.id)); setShowModal(false); } catch (err) { alert("Hata."); }
  };

  const handleChange = (e) => setEditDetails(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const formatDate = (date) => date ? new Date(date).toLocaleDateString('tr-TR') : '';

  if (!token) return <LoginScreen onLogin={handleLogin} />;

  return (
    <Container className="py-5" fluid="md">
      {/* HEADER */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-center mb-5 gap-3">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <h1 className="fw-bold display-5 mb-0" style={{ color: '#fff' }}><span style={{ color: 'var(--accent-color)' }}>Pro</span>Katalog</h1>
            <p className="text-secondary mb-0">Dijital Stok Yönetimi ({items.length} Ürün)</p>
        </motion.div>
        <div className="d-flex gap-2">
            <Button variant="outline-light" className="modern-btn d-flex align-items-center gap-2 shadow-sm" onClick={() => { setShowCategoryModal(true); }}><FaLayerGroup /> Kategoriler</Button>
            <Button variant="outline-info" className="modern-btn d-flex align-items-center gap-2 shadow-sm" onClick={() => { setShowUserModal(true); fetchUsers(); }}><FaUsers /> Kullanıcılar</Button>
            <Button variant="outline-success" className="modern-btn d-flex align-items-center gap-2 shadow-sm" onClick={openXmlFeed}><FaRss /> XML Beslemesi</Button>
            <Button variant="outline-danger" className="modern-btn d-flex align-items-center gap-2 shadow-sm ms-2" onClick={handleLogout}><FaLock /> Çıkış</Button>
        </div>
      </div>
      
      {/* INPUT AREA */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Row className="mb-4 g-3">
            <Col lg={7}>
                <Card className="modern-card p-2 border-0 shadow-lg">
                    <Form onSubmit={handleAddItem}>
                        <InputGroup>
                            <div style={{ width: '200px' }}><CategoryInput value={selectedCategory} categories={categories} onChange={setSelectedCategory} onAddCategory={handleAddCategory} /></div>
                            <Form.Control className="modern-input border-0 py-3 ps-4 shadow-none" placeholder="Link yapıştırın..." value={url} onChange={(e) => setUrl(e.target.value)} />
                            <Button variant="primary" type="submit" disabled={loading} className="modern-btn px-4 ms-2">{loading ? <Spinner size="sm" animation="border"/> : <FaPlus />}</Button>
                        </InputGroup>
                    </Form>
                </Card>
            </Col>
            <Col lg={5} className="d-flex gap-2">
                <Button variant="outline-info" className="modern-btn flex-grow-1 text-white gap-2 d-flex align-items-center justify-content-center" onClick={() => setShowManualModal(true)}><FaEdit /> Manuel</Button>
                <input type="file" ref={fileInputRef} onChange={handleCsvUpload} accept=".csv" hidden />
                <Button variant="outline-secondary" disabled={csvLoading} className="modern-btn flex-grow-1 text-white gap-2 d-flex align-items-center justify-content-center" onClick={() => fileInputRef.current.click()}>{csvLoading ? <Spinner size="sm"/> : <><FaFileUpload/> CSV</>}</Button>
            </Col>
        </Row>
        <AnimatePresence>
            {errorMsg && <Alert variant="danger" className="bg-danger bg-opacity-25 text-white border-0">{errorMsg}</Alert>}
            {successMsg && <Alert variant="success" className="bg-success bg-opacity-25 text-white border-0">{successMsg}</Alert>}
        </AnimatePresence>
      </motion.div>

      {/* FILTERS */}
      <Card className="mb-4 modern-card p-3 shadow-sm border-0">
          <Row className="g-3 align-items-center">
              <Col md={6}>
                  <InputGroup className="bg-black bg-opacity-25 rounded-pill overflow-hidden px-3">
                      <InputGroup.Text className="bg-transparent border-0 text-secondary"><FaSearch /></InputGroup.Text>
                      <Form.Control placeholder="Ara..." className="bg-transparent border-0 text-white shadow-none py-2" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                  </InputGroup>
              </Col>
              <Col md={6} className="d-flex gap-2 flex-wrap justify-content-md-end">
                  {['all', 'in_xml', 'incomplete', 'no_stock'].map(type => (
                      <Button key={type} variant={filterType === type ? (type === 'all' ? 'light' : type === 'in_xml' ? 'success' : type === 'incomplete' ? 'danger' : 'warning') : 'outline-secondary'} size="sm" onClick={() => setFilterType(type)} className="rounded-pill px-3">
                          {type === 'all' ? 'Tümü' : type === 'in_xml' ? 'XML' : type === 'incomplete' ? 'Eksik' : 'Stok Yok'}
                      </Button>
                  ))}
              </Col>
          </Row>
      </Card>

      {/* GRID */}
      <Row xs={1} md={2} lg={3} xl={4} className="g-4 mb-5">
        <AnimatePresence mode='popLayout'>
          {currentItems.map((item, index) => {
            const incomplete = !item.details.price || !item.details.moldPrice;
            const inXml = item.inXml ?? true;
            const stock = item.details.quantity || 0;
            return (
            <Col key={item.id} as={motion.div} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <Card className={`h-100 modern-card ${incomplete ? 'card-incomplete' : ''}`} onClick={() => openItem(item)} style={{ cursor: 'pointer' }}>
                <div style={{ height: '300px', overflow: 'hidden', position: 'relative', background: '#121212' }}>
                   <Card.Img variant="top" src={item.imageUrl} loading="lazy" style={{ objectFit: 'contain', height: '100%', width: '100%', padding: '10px' }} />
                   <div className="position-absolute top-0 end-0 m-3 z-3" onClick={(e) => e.stopPropagation()}>
                       {incomplete ? <span className="badge bg-danger bg-opacity-75"><FaTimesCircle/> XML Dışı</span> : 
                       <Button size="sm" variant={inXml ? "success" : "secondary"} className={`rounded-pill px-3 ${!inXml && 'opacity-50'}`} onClick={(e) => toggleXmlStatus(e, item)}>{inXml ? <FaCheckCircle/> : <FaTimesCircle/>} XML</Button>}
                   </div>
                   <div className="position-absolute top-0 start-0 m-3 d-flex flex-column gap-2">
                     {incomplete && <span className="warning-badge">Eksik</span>}
                     <span className={`stock-badge badge ${parseInt(stock)<=0 ? 'bg-danger' : 'bg-dark border-secondary'}`}><FaBoxOpen className="me-1"/> {stock}</span>
                     <span className="stock-badge badge bg-black bg-opacity-50 border-0 text-white-50">{item.category || 'Genel'}</span>
                   </div>
                   <div className="position-absolute bottom-0 w-100 p-2 d-flex justify-content-between align-items-end" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)' }}>
                        <small className="text-white opacity-75 small">{formatDate(item.createdAt)}</small>
                        <span className="text-white px-2 py-1 small rounded bg-black bg-opacity-50 font-monospace border border-secondary border-opacity-25">{item.stockCode}</span>
                   </div>
                </div>
                <Card.Body>
                    <Card.Title className="text-truncate mb-2">{item.title}</Card.Title>
                    <div className="d-flex gap-2">
                        {item.details.price && <span className="custom-badge">{item.details.price} ₺</span>}
                        {item.details.moldPrice && <span className="custom-badge" style={{color:'#00b894', background:'rgba(0,184,148,0.15)'}}>Kalıp: {item.details.moldPrice} ₺</span>}
                    </div>
                </Card.Body>
              </Card>
            </Col>
            );
          })}
        </AnimatePresence>
      </Row>
      
      {totalPages > 1 && <div className="d-flex justify-content-center mb-5"><Pagination><Pagination.Prev onClick={() => setCurrentPage(p => Math.max(p-1,1))} disabled={currentPage===1}/><Pagination.Item active>Sayfa {currentPage} / {totalPages}</Pagination.Item><Pagination.Next onClick={() => setCurrentPage(p => Math.min(p+1,totalPages))} disabled={currentPage===totalPages}/></Pagination></div>}

      {/* MANUEL EKLE MODAL */}
      <Modal show={showManualModal} onHide={() => setShowManualModal(false)} centered size="lg" contentClassName="bg-dark text-light border-secondary">
          <Modal.Header closeButton closeVariant="white"><Modal.Title>Manuel Ürün Ekle</Modal.Title></Modal.Header>
          <Modal.Body>
              <Form>
                  <Row>
                      <Col md={5}><div className="text-center p-4 border border-secondary rounded border-dashed" onClick={() => manualFileInputRef.current.click()} style={{cursor:'pointer', minHeight:'200px'}}>{manualForm.image ? <img src={URL.createObjectURL(manualForm.image)} style={{maxWidth:'100%', maxHeight:'200px'}}/> : <div className="text-secondary py-5"><FaImage size={40}/><p>Resim Seç</p></div>}</div><input type="file" ref={manualFileInputRef} hidden onChange={(e) => setManualForm({...manualForm, image: e.target.files[0]})}/></Col>
                      <Col md={7}>
                          <Form.Group className="mb-3">
                              <Form.Label className="small text-secondary fw-bold">KATEGORİ</Form.Label>
                              <CategoryInput value={manualForm.category} categories={categories} onChange={(v)=>setManualForm({...manualForm, category:v})} onAddCategory={handleAddCategory}/>
                          </Form.Group>
                          <Form.Group className="mb-3">
                              <Form.Label className="small text-secondary fw-bold">ÜRÜN ADI</Form.Label>
                              <Form.Control className="modern-input" placeholder="Örn: Mavi Vazo" value={manualForm.title} onChange={(e)=>setManualForm({...manualForm, title:e.target.value})}/>
                          </Form.Group>
                          <Row className="mb-3">
                              <Col>
                                <Form.Label className="small text-secondary fw-bold">SATIŞ (₺)</Form.Label>
                                <Form.Control type="number" className="modern-input" placeholder="0.00" value={manualForm.price} onChange={(e)=>setManualForm({...manualForm, price:e.target.value})}/>
                              </Col>
                              <Col>
                                <Form.Label className="small text-secondary fw-bold">KALIP (₺)</Form.Label>
                                <Form.Control type="number" className="modern-input" placeholder="0.00" value={manualForm.moldPrice} onChange={(e)=>setManualForm({...manualForm, moldPrice:e.target.value})}/>
                              </Col>
                              <Col xs={3}>
                                <Form.Label className="small text-secondary fw-bold">STOK</Form.Label>
                                <Form.Control type="number" className="modern-input" value={manualForm.quantity} onChange={(e)=>setManualForm({...manualForm, quantity:e.target.value})}/>
                              </Col>
                          </Row>
                          <Row className="mb-3">
                              <Col>
                                <Form.Label className="small text-secondary fw-bold">GENİŞLİK</Form.Label>
                                <Form.Control className="modern-input" placeholder="Örn: 10cm" value={manualForm.width} onChange={(e)=>setManualForm({...manualForm, width:e.target.value})}/>
                              </Col>
                              <Col>
                                <Form.Label className="small text-secondary fw-bold">YÜKSEKLİK</Form.Label>
                                <Form.Control className="modern-input" placeholder="Örn: 20cm" value={manualForm.height} onChange={(e)=>setManualForm({...manualForm, height:e.target.value})}/>
                              </Col>
                          </Row>
                          <Form.Group>
                            <Form.Label className="small text-secondary fw-bold">AÇIKLAMA</Form.Label>
                            <Form.Control as="textarea" rows={2} className="modern-input" placeholder="Ürün detayları..." value={manualForm.description} onChange={(e)=>setManualForm({...manualForm, description:e.target.value})}/>
                          </Form.Group>
                      </Col>
                  </Row>
              </Form>
          </Modal.Body>
          <Modal.Footer className="border-0"><Button variant="primary" className="modern-btn px-4" onClick={handleManualSubmit} disabled={manualLoading}>{manualLoading?<Spinner size="sm"/>:'Ürünü Kaydet'}</Button></Modal.Footer>
      </Modal>

      <Modal show={showModal} onHide={() => setShowModal(false)} centered size="lg" contentClassName="bg-dark text-light border-secondary">
        <Modal.Header closeButton closeVariant="white"><Modal.Title>Ürün Düzenle</Modal.Title></Modal.Header>
        <Modal.Body>
          {selectedItem && (
            <Row>
              <Col md={5} className="text-center bg-black rounded p-3 d-flex align-items-center justify-content-center">
                <img src={selectedItem.imageUrl} style={{maxWidth:'100%', maxHeight:'300px', objectFit:'contain'}}/>
              </Col>
              <Col md={7}>
                <Form.Group className="mb-3">
                    <Form.Label className="small text-secondary fw-bold">KATEGORİ</Form.Label>
                    <CategoryInput value={editCategory} categories={categories} onChange={setEditCategory} onAddCategory={handleAddCategory}/>
                </Form.Group>
                <Form.Group className="mb-3">
                    <Form.Label className="small text-secondary fw-bold">ÜRÜN ADI</Form.Label>
                    <Form.Control className="modern-input" value={editTitle} onChange={(e)=>setEditTitle(e.target.value)}/>
                </Form.Group>
                <Row className="mb-3">
                    <Col>
                        <Form.Label className="small text-secondary fw-bold">SATIŞ (₺)</Form.Label>
                        <Form.Control className="modern-input" value={editDetails.price} onChange={handleChange} name="price"/>
                    </Col>
                    <Col>
                        <Form.Label className="small text-secondary fw-bold">KALIP (₺)</Form.Label>
                        <Form.Control className="modern-input" value={editDetails.moldPrice} onChange={handleChange} name="moldPrice"/>
                    </Col>
                    <Col xs={3}>
                        <Form.Label className="small text-secondary fw-bold">STOK</Form.Label>
                        <Form.Control className="modern-input" type="number" value={editDetails.quantity} onChange={handleChange} name="quantity"/>
                    </Col>
                </Row>
                <Row className="mb-3">
                    <Col>
                        <Form.Label className="small text-secondary fw-bold">GENİŞLİK</Form.Label>
                        <Form.Control className="modern-input" value={editDetails.width} onChange={handleChange} name="width"/>
                    </Col>
                    <Col>
                        <Form.Label className="small text-secondary fw-bold">YÜKSEKLİK</Form.Label>
                        <Form.Control className="modern-input" value={editDetails.height} onChange={handleChange} name="height"/>
                    </Col>
                </Row>
                <Form.Group>
                    <Form.Label className="small text-secondary fw-bold">AÇIKLAMA</Form.Label>
                    <Form.Control as="textarea" rows={3} className="modern-input" value={editDetails.description} onChange={handleChange} name="description"/>
                </Form.Group>
              </Col>
            </Row>
          )}
        </Modal.Body>
        <Modal.Footer className="border-0">
          <Button variant="outline-danger" onClick={handleDelete} className="me-auto modern-btn">Sil</Button>
          <Button variant="primary" className="modern-btn px-4" onClick={handleSaveDetails}>Değişiklikleri Kaydet</Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showCategoryModal} onHide={() => setShowCategoryModal(false)} centered contentClassName="bg-dark text-light border-secondary">
          <Modal.Header closeButton closeVariant="white" className="border-0"><Modal.Title>Kategoriler</Modal.Title></Modal.Header>
          <Modal.Body>
              <InputGroup className="mb-3"><Form.Control className="modern-input border-0" placeholder="Yeni kategori..." value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} /><Button variant="primary" onClick={() => handleAddCategory(null)}>Ekle</Button></InputGroup>
              <div className="d-flex flex-column gap-2" style={{maxHeight:'300px', overflowY:'auto'}}>{categories.map(c => <div key={c} className="d-flex justify-content-between p-2 border-bottom border-secondary border-opacity-25"><span>{c}</span>{c!=='Genel'&&<Button size="sm" variant="outline-danger" onClick={()=>handleDeleteCategory(c)}><FaTrash/></Button>}</div>)}</div>
          </Modal.Body>
      </Modal>

      {/* KULLANICI YÖNETİM MODALI */}
      <Modal show={showUserModal} onHide={() => setShowUserModal(false)} centered contentClassName="bg-dark text-light border-secondary">
          <Modal.Header closeButton closeVariant="white" className="border-0"><Modal.Title>Kullanıcı Yönetimi</Modal.Title></Modal.Header>
          <Modal.Body>
              <Form className="mb-4 p-3 border border-secondary border-opacity-25 rounded bg-black bg-opacity-25">
                  <h6 className="text-muted small mb-3">YENİ KULLANICI EKLE</h6>
                  <InputGroup className="mb-2">
                      <Form.Control className="modern-input" placeholder="Kullanıcı Adı" value={newUser} onChange={(e) => setNewUser(e.target.value)} />
                      <Form.Control className="modern-input" type="password" placeholder="Şifre" value={newPass} onChange={(e) => setNewPass(e.target.value)} />
                      <Button variant="success" onClick={handleAddUser}><FaPlus /></Button>
                  </InputGroup>
              </Form>

              <h6 className="text-muted small mb-2">KAYITLI KULLANICILAR</h6>
              <div className="d-flex flex-column gap-2" style={{maxHeight:'300px', overflowY:'auto'}}>
                  {users.map(u => (
                      <div key={u.username} className="p-3 rounded bg-black bg-opacity-25 border border-secondary border-opacity-25">
                          <div className="d-flex justify-content-between align-items-center mb-2">
                              <span className="fw-bold"><FaUser className="me-2"/>{u.username}</span>
                              <Button size="sm" variant="outline-danger" onClick={() => handleDeleteUser(u.username)} className="border-0"><FaTrash /></Button>
                          </div>
                          <InputGroup size="sm">
                              <Form.Control 
                                  className="bg-dark text-white border-secondary" 
                                  placeholder="Yeni şifre..." 
                                  onChange={(e) => {
                                      if(changePassUser !== u.username) { setChangePassUser(u.username); }
                                      setChangePassVal(e.target.value);
                                  }}
                                  value={changePassUser === u.username ? changePassVal : ''}
                              />
                              <Button variant="outline-secondary" onClick={() => { setChangePassUser(u.username); handleChangePassword(); }}><FaKey /> Güncelle</Button>
                          </InputGroup>
                      </div>
                  ))}
              </div>
          </Modal.Body>
      </Modal>
    </Container>
  );
}

export default App;
