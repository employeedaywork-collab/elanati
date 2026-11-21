import { useSearchParams } from 'react-router-dom';
import Advertisements from '../components/Advertisements';
import { usePublicContext } from '../components/PublicLayout';
import { AdCategory } from '../types';

export default function AdsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { ads, categories, loadingAds, onViewAd, onAddAd } = usePublicContext();

  const selectedCategory = (searchParams.get('category') as AdCategory | null) || 'الكل';

  const handleCategoryChange = (cat: AdCategory | 'الكل') => {
    if (cat === 'الكل') {
      setSearchParams({});
    } else {
      setSearchParams({ category: cat });
    }
  };

  return (
    <div className="pt-16">
      <Advertisements
        ads={ads}
        categories={categories}
        loading={loadingAds}
        selectedCategory={selectedCategory}
        onCategoryChange={handleCategoryChange}
        onViewAd={onViewAd}
        onAddAd={onAddAd}
      />
    </div>
  );
}
