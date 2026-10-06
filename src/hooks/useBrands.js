import { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { getCachedBrandCatalog, cacheBrandCatalog } from '../storage';

/**
 * Shared hook for fetching the global brand catalog with IndexedDB cache-first strategy.
 * Replaces duplicate brand-fetching useEffects in OnboardingModal, Profile, Admin,
 * AssignBrandModal, and BrandManager.
 */
export function useBrands() {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // 1. Try device cache first (instant, 0ms)
    getCachedBrandCatalog()
      .then((cached) => {
        if (cached && !cancelled) {
          setBrands(cached);
          setLoading(false);
        }
      })
      .catch(() => {});

    // 2. Sync from Firestore (source of truth)
    const fetchBrands = async () => {
      try {
        const q = query(collection(db, 'brands'), orderBy('brandName', 'asc'));
        const snap = await getDocs(q);
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (!cancelled) {
          setBrands(list);
          cacheBrandCatalog(list);
        }
      } catch (err) {
        console.error('Error fetching brand catalog:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchBrands();

    return () => { cancelled = true; };
  }, []);

  return { brands, loading, setBrands };
}
