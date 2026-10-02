import React, { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
import type { AdminSession, Product, ProductImage, ProductCompatibilityEntry, LinkedProduct, Category, VehicleBrand, VehicleModel } from '../../types/admin';

interface ProductFormModalProps {
  session: AdminSession;
  mode: 'create' | 'edit';
  product: Product | null;
  onClose: () => void;
  onSubmit: (payload: any) => void;
}

interface FamilySibling {
  id: number;
  sku: string;
  name: string;
  price: number;
  sale_price: number | null;
  stock: number;
  status: string;
  variant_options: Record<string, string> | null;
}

const ProductFormModal: React.FC<ProductFormModalProps> = ({ session, mode, product, onClose, onSubmit }) => {
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [price, setPrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [stock, setStock] = useState('10');
  const [description, setDescription] = useState('');
  const [compatibility, setCompatibility] = useState<ProductCompatibilityEntry[]>([]);

  const [stockStatus, setStockStatus] = useState('in_stock');
  const [lowStockThreshold, setLowStockThreshold] = useState('5');

  const [images, setImages] = useState<{url: string, alt: string}[]>([]);

  const [upsells, setUpsells] = useState<LinkedProduct[]>([]);
  const [crossSells, setCrossSells] = useState<LinkedProduct[]>([]);
  const [searchLinkTerm, setSearchLinkTerm] = useState('');
  const [searchLinkResults, setSearchLinkResults] = useState<Product[]>([]);

  const [brand, setBrand] = useState('');
  const [barcode, setBarcode] = useState('');
  const [supplierCode, setSupplierCode] = useState('');
  const [cost, setCost] = useState('');
  const [weightG, setWeightG] = useState('');
  const [lengthMm, setLengthMm] = useState('');
  const [widthMm, setWidthMm] = useState('');
  const [heightMm, setHeightMm] = useState('');
  const [dropshipping, setDropshipping] = useState(false);
  const [ondemand, setOndemand] = useState(false);
  const [deliveryPlant, setDeliveryPlant] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [category2Id, setCategory2Id] = useState('');
  const [category3Id, setCategory3Id] = useState('');
  const [allCategories, setAllCategories] = useState<Category[]>([]);

  const [tempBrand, setTempBrand] = useState('');
  const [tempModel, setTempModel] = useState('');
  const [tempYear, setTempYear] = useState('');

  const [draggedImgIndex, setDraggedImgIndex] = useState<number | null>(null);

  // Variantes: productos con el mismo código de modelo se muestran juntos en la
  // tienda, con selector de talla/color (ver backend lib/catalog-query.ts).
  const [familyCode, setFamilyCode] = useState('');
  const [variantTalla, setVariantTalla] = useState('');
  const [variantColor, setVariantColor] = useState('');
  const [familySiblings, setFamilySiblings] = useState<FamilySibling[]>([]);

  const [vehicleBrands, setVehicleBrands] = useState<VehicleBrand[]>([]);
  const [vehicleModels, setVehicleModels] = useState<VehicleModel[]>([]);

  useEffect(() => {
    const adminWpId = session?.user_id || session?.wp_id || session?.user?.publicMetadata?.wp_id || '';
    const adminEmail = session?.user_email || session?.user?.emailAddresses?.[0]?.emailAddress || session?.email || '';
    const adminToken = session?.token || session?.jwt || '';

    if (!adminToken) return;

    fetch(`/api/admin?action=get-vehicle-brands`, { headers: { 'Authorization': `Bearer ${adminToken}` } })
      .then(r => r.json())
      .then(data => setVehicleBrands(Array.isArray(data) ? data : []))
      .catch(err => console.error(err));

    fetch(`/api/admin?action=get-vehicle-models`, { headers: { 'Authorization': `Bearer ${adminToken}` } })
      .then(r => r.json())
      .then(data => setVehicleModels(Array.isArray(data) ? data : []))
      .catch(err => console.error(err));

    fetch(`/api/admin?action=get-categories`, { headers: { 'Authorization': `Bearer ${adminToken}` } })
      .then(r => r.json())
      .then(data => setAllCategories(Array.isArray(data) ? data : []))
      .catch(err => console.error(err));
  }, [session]);

  useEffect(() => {
    if (mode === 'edit' && product) {
      setName(product.name || '');
      setSku(product.sku || '');
      setPrice(((product.price || 0) / 100).toString());
      setSalePrice(product.sale_price ? ((product.sale_price || 0) / 100).toString() : '');
      setStock((product.stock || 0).toString());
      setDescription(product.description || '');

      let imgs: ProductImage[] = [];
      try { imgs = product.images ? (typeof product.images === 'string' ? JSON.parse(product.images) : product.images) : []; } catch {}
      if (!Array.isArray(imgs)) imgs = [];
      setImages(imgs.map(img => typeof img === 'string' ? {url: img, alt: ''} : {url: img.url || '', alt: img.alt || ''}));

      let compat: ProductCompatibilityEntry[] = [];
      try { compat = product.compatibility ? (typeof product.compatibility === 'string' ? JSON.parse(product.compatibility) : product.compatibility) : []; } catch {}
      setCompatibility(compat);

      setBrand(product.brand || '');
      setBarcode(product.barcode || '');
      setSupplierCode(product.supplier_code || '');
      setCost(product.cost ? (product.cost / 100).toString() : '');
      setWeightG(product.weight_g ? product.weight_g.toString() : '');
      setLengthMm(product.length_mm ? product.length_mm.toString() : '');
      setWidthMm(product.width_mm ? product.width_mm.toString() : '');
      setHeightMm(product.height_mm ? product.height_mm.toString() : '');
      setDropshipping(product.dropshipping === true);
      setOndemand(product.ondemand === true);
      setDeliveryPlant(product.delivery_plant || '');
      setCategoryId(product.category_id ? product.category_id.toString() : '');
      setCategory2Id(product.category2_id ? product.category2_id.toString() : '');
      setCategory3Id(product.category3_id ? product.category3_id.toString() : '');

      setFamilyCode(product.family_code || '');
      setVariantTalla(product.variant_options?.Talla || '');
      setVariantColor(product.variant_options?.Color || '');
      const token = session?.token || session?.jwt || '';
      fetch(`/api/admin?action=product-family&product_id=${product.id}`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(r => (r.ok ? r.json() : []))
        .then((rows: FamilySibling[]) => {
          setFamilySiblings(Array.isArray(rows) ? rows : []);
          const self = Array.isArray(rows) ? rows.find((r) => r.id === product.id) : undefined;
          if (self && !product.variant_options) {
            setVariantTalla(self.variant_options?.Talla || '');
            setVariantColor(self.variant_options?.Color || '');
          }
        })
        .catch(() => setFamilySiblings([]));
    }
  }, [mode, product]);

  // Audit 2026-08-15, finding #16: el form dividía por 100 al cargar y
// reenviaba la cifra en EUR al backend; multiplicar luego por 100 en el
// backend daba una segunda conversión silenciosa. Contrato único: payload
// en CENTS, DB en CENTS, form en EUR. Centralizamos la conversión.
const toCents = (eurosStr: string): number => {
  const n = parseFloat(eurosStr);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      id: product?.id,
      name,
      sku,
      price: toCents(price),
      salePrice: salePrice ? toCents(salePrice) : null,
      stock,
      stock_status: stockStatus,
      low_stock_threshold: lowStockThreshold,
      description,
      images: images,
      compatibility,
      status: 'published',
      brand,
      barcode,
      supplierCode,
      cost: cost ? toCents(cost) : null,
      weight_g: weightG || null,
      length_mm: lengthMm || null,
      width_mm: widthMm || null,
      height_mm: heightMm || null,
      dropshipping,
      ondemand,
      deliveryPlant,
      categoryId: categoryId || null,
      category2Id: category2Id || null,
      category3Id: category3Id || null,
      type: 'simple',
      familyCode,
      variantOptions: { Talla: variantTalla, Color: variantColor },
      upsells,
      crossSells
    };
    onSubmit(payload);
  };

  const addCompatibility = () => {
    if (!tempBrand || !tempModel) return;
    setCompatibility([
      ...compatibility,
      { brand: tempBrand, model: tempModel, year: tempYear || undefined }
    ]);
    setTempBrand('');
    setTempModel('');
    setTempYear('');
  };

  const removeCompatibility = (idx: number) => {
    setCompatibility(compatibility.filter((_, i) => i !== idx));
  };

  const handleSearchLinks = async () => {
    if (!searchLinkTerm) return;
    try {
      const adminToken = session?.token || session?.jwt || '';
      const r = await fetch(`/api/admin?action=products-list&search=${encodeURIComponent(searchLinkTerm)}&limit=10`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      const data = await r.json();
      if (data.products) {
        setSearchLinkResults(data.products);
      }
    } catch (e) { console.error(e); }
  };

  const addLink = (productItem: Product, type: 'upsell' | 'cross_sell') => {
    const item = { id: productItem.id, name: productItem.name, sku: productItem.sku };
    if (type === 'upsell') {
      if (!upsells.some(u => u.id === item.id)) setUpsells([...upsells, item]);
    } else {
      if (!crossSells.some(c => c.id === item.id)) setCrossSells([...crossSells, item]);
    }
  };

  const inputClass = "w-full bg-[#1a1b1e] border border-tech-border rounded-xl px-4 py-3 text-tech-text placeholder-zinc-600 focus:outline-none focus:border-tech-yellow transition-all";
  const labelClass = "block text-[10px] uppercase font-black tracking-widest text-tech-muted mb-2";
  const monoInputClass = inputClass + " font-mono";

  return (
    <div className="fixed inset-0 z-50 bg-tech-carbon/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-tech-card border border-tech-border rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-8 shadow-2xl">
        <div className="flex justify-between items-start mb-6">
          <h3 className="text-xl font-black italic uppercase tracking-wider text-tech-text">
            {mode === 'edit' ? 'Editar Producto' : 'Nuevo Producto'}
          </h3>
          <button onClick={onClose} className="text-tech-muted hover:text-tech-text">
            <Icons.X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 text-xs text-left">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Nombre Recambio</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Escape Yoshimura R-11" required className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>SKU de Almacén</label>
              <input type="text" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Ej. ESC-YOSH-R11" required className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Precio Base (€)</label>
                <input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" required className={monoInputClass} />
              </div>
              <div>
                <label className={labelClass}>Precio Oferta (€)</label>
                <input type="number" step="0.01" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} placeholder="Opcional" className={monoInputClass} />
              </div>
              <div>
                <label className={labelClass}>Inventario</label>
                <div className="grid grid-cols-3 gap-2">
                  <input type="number" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="Cant." className={monoInputClass} title="Cantidad" />
                  <select value={stockStatus} onChange={(e) => setStockStatus(e.target.value)} className={inputClass}>
                    <option value="in_stock">En Stock</option>
                    <option value="out_of_stock">Agotado</option>
                    <option value="backorder">Reservable</option>
                  </select>
                  <input type="number" value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} placeholder="Aviso Bajas Ex." className={monoInputClass} title="Umbral de aviso" />
                </div>
              </div>
            </div>

          {/* Variantes (talla/color) */}
          <div className="border border-tech-border rounded-xl p-4 bg-[#1a1b1e]/10">
            <h4 className={labelClass + " mb-1 flex items-center gap-1.5"}>
              <Icons.Layers size={12} /> Variantes
            </h4>
            <p className="text-[10px] text-tech-muted mb-3">
              Los productos con el mismo código de modelo aparecen como una sola ficha en la tienda, con selector de talla y color.
              Los de Bihr se agrupan solos al importar.
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Código de modelo</label>
                <input type="text" value={familyCode} onChange={(e) => setFamilyCode(e.target.value)} placeholder="Vacío = producto suelto" className={monoInputClass} />
              </div>
              <div>
                <label className={labelClass}>Talla</label>
                <input type="text" value={variantTalla} onChange={(e) => setVariantTalla(e.target.value)} placeholder="Ej. XL, 42, 10/L" className={monoInputClass} />
              </div>
              <div>
                <label className={labelClass}>Color</label>
                <input type="text" value={variantColor} onChange={(e) => setVariantColor(e.target.value)} placeholder="Ej. Negro" className={inputClass} />
              </div>
            </div>
            {familySiblings.length > 1 && (
              <div className="mt-3 max-h-48 overflow-y-auto border border-tech-border rounded-lg">
                <table className="w-full text-[10px] font-mono">
                  <thead className="text-tech-muted uppercase">
                    <tr><th className="text-left p-1.5">SKU</th><th className="text-left p-1.5">Talla</th><th className="text-left p-1.5">Color</th><th className="text-right p-1.5">Precio</th><th className="text-right p-1.5">Stock</th></tr>
                  </thead>
                  <tbody>
                    {familySiblings.map((v) => (
                      <tr key={v.id} className={`border-t border-tech-border ${v.id === product?.id ? 'text-tech-yellow' : 'text-tech-text'}`}>
                        <td className="p-1.5">{v.sku}</td>
                        <td className="p-1.5">{v.variant_options?.Talla || '—'}</td>
                        <td className="p-1.5">{v.variant_options?.Color || '—'}</td>
                        <td className="p-1.5 text-right">{((v.sale_price || v.price) / 100).toFixed(2)} €</td>
                        <td className="p-1.5 text-right">{v.stock}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Categorías */}
          <div className="border border-tech-border rounded-xl p-4 bg-[#1a1b1e]/10">
            <h4 className={labelClass + " mb-4 flex items-center gap-1.5"}>
              <Icons.Tag size={12} /> Categorías
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Categoría Principal</label>
                <select
                  value={categoryId}
                  onChange={(e) => {
                    setCategoryId(e.target.value);
                    setCategory2Id('');
                    setCategory3Id('');
                  }}
                  className={inputClass}
                >
                  <option value="">Sin categoría</option>
                  {allCategories.filter((c: Category) => !c.parent_id).map((c: Category) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Subcategoría 2</label>
                <select
                  value={category2Id}
                  onChange={(e) => {
                    setCategory2Id(e.target.value);
                    setCategory3Id('');
                  }}
                  className={inputClass}
                  disabled={!categoryId}
                >
                  <option value="">Sin subcategoría</option>
                  {allCategories.filter((c: Category) => c.parent_id && c.parent_id.toString() === categoryId).map((c: Category) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Subcategoría 3</label>
                <select
                  value={category3Id}
                  onChange={(e) => setCategory3Id(e.target.value)}
                  className={inputClass}
                  disabled={!category2Id}
                >
                  <option value="">Sin subcategoría</option>
                  {allCategories.filter((c: Category) => c.parent_id && c.parent_id.toString() === category2Id).map((c: Category) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Fabricante y Códigos */}
          <div className="border border-tech-border rounded-xl p-4 bg-[#1a1b1e]/10">
            <h4 className={labelClass + " mb-4 flex items-center gap-1.5"}>
              <Icons.Tag size={12} /> Fabricante y Códigos
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Marca</label>
                <input type="text" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Ej. Yoshimura" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Código de Barras</label>
                <input type="text" value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Ej. 843123456789" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Código Proveedor</label>
                <input type="text" value={supplierCode} onChange={(e) => setSupplierCode(e.target.value)} placeholder="Ej. BIH-12345" className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className={labelClass}>Coste (€)</label>
                <input type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="Ej. 350.00" className={monoInputClass} />
              </div>
              <div>
                <label className={labelClass}>Planta de Entrega</label>
                <input type="text" value={deliveryPlant} onChange={(e) => setDeliveryPlant(e.target.value)} placeholder="Ej. BCN-01" className={inputClass} />
              </div>
            </div>
          </div>

          {/* Dimensiones y Peso */}
          <div className="border border-tech-border rounded-xl p-4 bg-[#1a1b1e]/10">
            <h4 className={labelClass + " mb-4 flex items-center gap-1.5"}>
              <Icons.Ruler size={12} /> Dimensiones y Peso
            </h4>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className={labelClass}>Peso (g)</label>
                <input type="number" value={weightG} onChange={(e) => setWeightG(e.target.value)} placeholder="Ej. 1500" className={monoInputClass} />
              </div>
              <div>
                <label className={labelClass}>Largo (mm)</label>
                <input type="number" value={lengthMm} onChange={(e) => setLengthMm(e.target.value)} placeholder="Ej. 300" className={monoInputClass} />
              </div>
              <div>
                <label className={labelClass}>Ancho (mm)</label>
                <input type="number" value={widthMm} onChange={(e) => setWidthMm(e.target.value)} placeholder="Ej. 200" className={monoInputClass} />
              </div>
              <div>
                <label className={labelClass}>Alto (mm)</label>
                <input type="number" value={heightMm} onChange={(e) => setHeightMm(e.target.value)} placeholder="Ej. 100" className={monoInputClass} />
              </div>
            </div>
          </div>

          {/* Logística */}
          <div className="border border-tech-border rounded-xl p-4 bg-[#1a1b1e]/10">
            <h4 className={labelClass + " mb-4 flex items-center gap-1.5"}>
              <Icons.Truck size={12} /> Logística y Envío
            </h4>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={dropshipping} onChange={(e) => setDropshipping(e.target.checked)} className="accent-racing-orange" />
                <span className="text-[#cbd5e1] text-[11px] font-bold uppercase tracking-wider">Dropshipping</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={ondemand} onChange={(e) => setOndemand(e.target.checked)} className="accent-racing-orange" />
                <span className="text-[#cbd5e1] text-[11px] font-bold uppercase tracking-wider">Bajo Demanda</span>
              </label>
            </div>
          </div>

          <div className="border border-tech-border rounded-xl p-4 bg-[#1a1b1e]/10">
            <div className="flex justify-between items-center mb-4">
              <h4 className={labelClass + " !mb-0 flex items-center gap-1.5"}>
                <Icons.Image size={12} /> Galería Multimedia
              </h4>
              <button type="button" onClick={() => setImages([...images, {url: '', alt: ''}])} className="text-[10px] bg-zinc-800 text-white px-3 py-1.5 rounded-lg hover:bg-zinc-700">
                + Añadir Imagen
              </button>
            </div>

            <div className="space-y-2">
              {images.map((img, idx) => (
                <div
                  key={idx}
                  className={`flex gap-3 items-center bg-zinc-900 border ${draggedImgIndex === idx ? 'border-tech-yellow' : 'border-zinc-800'} rounded-lg p-2 cursor-move`}
                  draggable
                  onDragStart={() => setDraggedImgIndex(idx)}
                  onDragEnter={() => {
                    if (draggedImgIndex === null || draggedImgIndex === idx) return;
                    const newImgs = [...images];
                    const item = newImgs.splice(draggedImgIndex, 1)[0];
                    newImgs.splice(idx, 0, item);
                    setDraggedImgIndex(idx);
                    setImages(newImgs);
                  }}
                  onDragEnd={() => setDraggedImgIndex(null)}
                  onDragOver={(e) => e.preventDefault()}
                >
                  <div className="text-zinc-600 px-2 cursor-grab"><Icons.GripVertical size={16}/></div>
                  {img.url ? (
                    <img src={img.url} alt="preview" className="w-10 h-10 object-cover rounded bg-zinc-800" onError={(e) => (e.currentTarget.style.display = 'none')} />
                  ) : (
                    <div className="w-10 h-10 flex items-center justify-center bg-zinc-800 rounded text-zinc-600"><Icons.Image size={16}/></div>
                  )}
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <input type="url" value={img.url} onChange={(e) => {const n=[...images]; n[idx].url=e.target.value; setImages(n);}} placeholder="URL de la imagen" className="bg-[#1a1b1e] border border-tech-border rounded px-2 py-1.5 text-[11px] text-tech-text" />
                    <input type="text" value={img.alt} onChange={(e) => {const n=[...images]; n[idx].alt=e.target.value; setImages(n);}} placeholder="Atributo ALT (SEO)" className="bg-[#1a1b1e] border border-tech-border rounded px-2 py-1.5 text-[11px] text-tech-text" />
                  </div>
                  <button type="button" onClick={() => setImages(images.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-400 p-2"><Icons.Trash2 size={14}/></button>
                </div>
              ))}
              {images.length === 0 && <div className="text-center text-[11px] text-tech-muted italic py-4">No hay imágenes.</div>}
            </div>
          </div>

          <div>
            <label className={labelClass}>Descripción del Producto</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detalles y ficha técnica..." rows={3} className={inputClass} />
          </div>

          {/* Ventas Cruzadas */}
          <div className="border border-tech-border rounded-xl p-4 bg-[#1a1b1e]/10">
            <h4 className={labelClass + " mb-4 flex items-center gap-1.5"}>
              <Icons.Link size={12} /> Ventas Cruzadas y Sugeridos
            </h4>

            <div className="mb-4">
              <label className="block text-[10px] text-tech-muted uppercase mb-1">Buscar producto para vincular</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchLinkTerm}
                  onChange={(e) => setSearchLinkTerm(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleSearchLinks())}
                  placeholder="Escribe el nombre o SKU..."
                  className={inputClass + " flex-1 !py-2"}
                />
                <button type="button" onClick={handleSearchLinks} className="bg-zinc-800 text-white px-4 rounded-lg hover:bg-zinc-700">
                  <Icons.Search size={16} />
                </button>
              </div>
              {searchLinkResults.length > 0 && (
                <div className="mt-2 bg-zinc-900 border border-zinc-800 rounded-lg max-h-40 overflow-y-auto">
                  {searchLinkResults.map((res: Product) => (
                    <div key={res.id} className="flex justify-between items-center p-2 border-b border-zinc-800/50 last:border-0 text-[11px] text-tech-text">
                      <span className="truncate mr-2">{res.name} <span className="text-tech-muted">({res.sku})</span></span>
                      <div className="flex gap-1 shrink-0">
                        <button type="button" onClick={() => addLink(res, 'upsell')} className="bg-tech-yellow text-black px-2 py-1 rounded hover:bg-yellow-500 font-bold">Upsell</button>
                        <button type="button" onClick={() => addLink(res, 'cross_sell')} className="bg-zinc-700 text-white px-2 py-1 rounded hover:bg-zinc-600">Cruzada</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h5 className="text-[11px] font-bold text-tech-yellow mb-2">Upsells (Productos Superiores)</h5>
                <div className="space-y-1">
                  {upsells.map((u, i) => (
                    <div key={i} className="flex justify-between bg-zinc-900 p-2 rounded text-[10px] text-tech-text">
                      <span className="truncate">{u.name} <span className="text-tech-muted">({u.sku})</span></span>
                      <button type="button" onClick={() => setUpsells(upsells.filter((_, idx) => idx !== i))} className="text-red-500 shrink-0"><Icons.X size={12}/></button>
                    </div>
                  ))}
                  {upsells.length === 0 && <p className="text-[10px] text-tech-muted italic">No hay upsells.</p>}
                </div>
              </div>
              <div>
                <h5 className="text-[11px] font-bold text-tech-text mb-2">Ventas Cruzadas (Complementarios)</h5>
                <div className="space-y-1">
                  {crossSells.map((c, i) => (
                    <div key={i} className="flex justify-between bg-zinc-900 p-2 rounded text-[10px] text-tech-text">
                      <span className="truncate">{c.name} <span className="text-tech-muted">({c.sku})</span></span>
                      <button type="button" onClick={() => setCrossSells(crossSells.filter((_, idx) => idx !== i))} className="text-red-500 shrink-0"><Icons.X size={12}/></button>
                    </div>
                  ))}
                  {crossSells.length === 0 && <p className="text-[10px] text-tech-muted italic">No hay ventas cruzadas.</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Compatibility Engine */}
          <div className="border border-tech-border rounded-xl p-4 bg-[#1a1b1e]/10">
            <h4 className={labelClass + " mb-4 flex items-center gap-1.5"}>
              <Icons.Wrench size={12} /> Compatibilidad de Motos
            </h4>
            <div className="grid grid-cols-3 gap-2 mb-4">
              <select value={tempBrand} onChange={(e) => { setTempBrand(e.target.value); setTempModel(''); }} className="bg-[#1a1b1e] border border-tech-border rounded-lg px-3 py-2 text-[11px] text-tech-text">
                <option value="">Marca</option>
                {vehicleBrands.map((b: VehicleBrand) => <option key={b.id} value={b.name}>{b.name}</option>)}
              </select>
              <select value={tempModel} onChange={(e) => setTempModel(e.target.value)} className="bg-[#1a1b1e] border border-tech-border rounded-lg px-3 py-2 text-[11px] text-tech-text">
                <option value="">Modelo</option>
                {vehicleModels.filter((m: VehicleModel) => !tempBrand || m.brand_name === tempBrand).map((m: VehicleModel) => <option key={m.id} value={m.name}>{m.name}</option>)}
              </select>
              <div className="flex gap-2">
                <input type="text" value={tempYear} onChange={(e) => setTempYear(e.target.value)} placeholder="Año (2024)" className="bg-[#1a1b1e] border border-tech-border rounded-lg px-3 py-2 text-[11px] text-tech-text w-full" />
                <button type="button" onClick={addCompatibility} className="bg-tech-border hover:bg-tech-yellow hover:text-tech-text text-[#cbd5e1] px-3.5 rounded-lg font-bold">+</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {compatibility.length === 0 ? (
                <span className="text-zinc-600 italic text-[10px]">Sin compatibilidades registradas.</span>
              ) : compatibility.map((comp: ProductCompatibilityEntry, idx: number) => (
                <span key={idx} className="bg-[#1a1b1e] border border-tech-border text-[#cbd5e1] px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5">
                  {comp.brand} {comp.model} {comp.year ? `(${comp.year})` : ''}
                  <button type="button" onClick={() => removeCompatibility(idx)} className="text-red-500 hover:text-tech-text">×</button>
                </span>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-tech-border">
            <button type="button" onClick={onClose} className="bg-[#1a1b1e] border border-tech-border text-tech-muted px-5 py-3 rounded-xl font-bold uppercase text-[10px] tracking-wider transition-all">
              Cancelar
            </button>
            <button type="submit" className="bg-tech-yellow hover:bg-orange-600 text-tech-text px-6 py-3 rounded-xl font-black uppercase italic tracking-wider text-[10px] transition-all shadow-lg shadow-orange-950/10">
              {mode === 'edit' ? 'Guardar Cambios' : 'Crear Producto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductFormModal;
