const tffMenuImageFiles = [
  'Ajwain Fish Tikka.avif', 'Aloo Dum Curry.avif', 'Aloo Gobi Masala.avif',
  'Apollo Fish.avif', 'Baby Corn Manchurian.avif', 'Bagara Rice.avif',
  'Bhindi Fry.avif', 'Bobbatlu.avif',
  'Bhimavaram Kodi vepudu.avif', 'Boneless Chicken Biryani.avif',
  'Boneless Kodi Vepudu.avif', 'Butter Chicken.avif', 'Butter Garlic Prawns.avif',
  'Butter Naan.avif', 'Garlic Naan.avif',
  'Chicken 65.avif', 'Chicken Biryani.avif', 'Chicken Drumstick.avif',
  'Chicken Kholapuri.avif',
  'Chicken Fried Rice.avif', 'Chicken Fry Pulao.avif', 'Chicken Lollipop.avif',
  'Chicken Majestic.avif', 'Chicken Noodles.avif', 'Chicken Tikka Masala.avif',
  'Chicken Tikka.avif', 'Chiilli Prawns.avif', 'Chilli Baby Corn.avif',
  'Chilli Chicken.avif', 'Chilli Egg.avif', 'Chilli Garlic Fish.avif',
  'Chilli Mushroom.avif', 'Chilli Paneer.avif', 'Chilli Prawns.avif',
  'Crispy baby Corn.avif', 'Curd.avif', 'Curd Rice.avif', 'Dal Fry.avif', 'Dal Tadka.avif',
  'Double Ka Meetha.avif', 'Dum Aloo Curry.avif', 'Egg Bhurji.avif',
  'Egg Biryani.avif', 'Fryums.avif',
  'Egg Fried Rice.avif', 'Egg Manchurian.avif', 'Egg Noodles.avif',
  'Fish Fry Tawa.avif', 'Fish Pulsu.avif', 'Fish Pulusu.avif',
  'Fish Tikka Masala.avif', 'Fish Tikka.avif', 'Fry Piece Chicken Biryani.avif',
  'Gobi Manchurian.avif', 'Gongura Chicken Curry.avif', 'Gongura Kodi Koora.avif',
  'Gutti Vankaya Pulao Biryani.avif', 'Guttivankaya Koora.avif',
  'Gulab Jamun.avif', 'Green Salad.avif',
  'Jeedipappu Kodi Vepudu.avif', 'Jeera Rice.avif', 'Kadai Chicken.avif',
  'Kadai Paneer.avif', 'Kadai Veg.avif', 'Kaju Crispy corn.avif', 'Kaju Mushroom.avif',
  'Kaju Paneer Biryani.avif', 'Kaju Paneer.avif', 'Kaju Pulao.avif',
  'Kala Jamun.avif', 'Karimnagar Kodi winfs.avif', 'Karivepaku Kodi Vepudu.avif',
  'Karvepaku Kodi Vepudu.avif', 'Kodi Guddu Pulusu.avif', 'Kodi Kabab.avif',
  'Kodi Koora.avif', 'Kodi Kura.avif', 'Kodi wings.avif',
  'Kothimmeera Paneer vepudu.avif', 'Kurnool Chicken Curry.avif',
  'Loose prawns.avif', 'Lucknowi Mutton Korma.avif', 'Malai Paneer Tikka.avif',
  'Mirch ka Salan.avif', 'Miriyala Mamsam Vepudu.avif', 'Mix-veg.avif',
  'Mamsam Jeddipapu Fry.avif', 'Masala Peanuts.avif', 'Mushroom Masala.avif',
  'Mushroom Pulao.avif', 'Mushroom starter.avif', 'Mutton Biryani Fry Piece.avif',
  'Mutton Dum Biryani.avif', 'Mutton Ghee roast.avif', 'Mutton Masala.avif',
  'Mutton Rogan Josh.avif', 'Natukodi Pulusu.avif', 'Nizami Handi.avif',
  'Pachimirchi Paneer Pulao.avif', 'Palak Paneer.avif', 'Palak Pappu.avif',
  'Pandumirchi Kodi Kebab.avif', 'Paneer Butter Masala.avif',
  'Paneer Kholapuri.avif', 'Paneer Majestic.avif', 'Paneer Masala.avif',
  'Paneer Tikka Masala.avif', 'Paneer Tikka.avif', 'Paneer biryani.avif',
  'Paneer vepudu.avif', 'Paneer-65.avif', 'Pepper Chicken.avif', 'Phulka.avif',
  'Plain Naan.avif', 'Plain Rice.avif', 'Prawns Biryani.avif', 'Prawns Curry.avif',
  'Prawns Vepudu.avif', 'Pickle.avif', 'Pulihora.avif', 'Raita.avif',
  'Rasam.avif', 'Sambar.avif', 'Tandoori Roti.avif',
  'Telangana Chicken Curry.avif',
  'Veg Biryani.avif', 'Veg Curry.avif', 'Veg Fried Rice.avif',
  'Veg Kholapuri.avif', 'Veg Manchuria.avif', 'Veg Manchurian.avif',
  'Veg Noodles.avif', 'Vellulli Paneer Vepudu.avif',
] as const;

const normalizeMenuName = (name: string) =>
  name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');

const getMenuImageFolder = (filename: string) => {
  const normalized = filename.toLowerCase();
  if (/masala peanuts/.test(normalized)) return 'starters';
  if (/biryani|pulao/.test(normalized)) return 'biryani';
  if (/rice|noodles|pulihora/.test(normalized)) return 'rice-items';
  if (/naan|phulka|roti/.test(normalized)) return 'indian-breads';
  if (/jamun|meetha|bobbatlu/.test(normalized)) return 'desserts';
  if (/curry|pulsu|pulusu|koora|kura|masala|handi|kholapuri|bhindi|pappu|salan|curd|pickle|raita|rasam|sambar|kadai/.test(normalized)) {
    return 'curry';
  }
  return 'starters';
};

const getMenuImageSlug = (filename: string) =>
  filename
    .replace(/\.avif$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const localMenuImageByName: Readonly<Record<string, string>> = Object.fromEntries(
  tffMenuImageFiles.map((filename) => [
    normalizeMenuName(filename.replace(/\.avif$/, '')),
    `/menu-images/${getMenuImageFolder(filename)}/${getMenuImageSlug(filename)}/large.jpg`,
  ]),
);

const localMenuImageAliases: Readonly<Record<string, string>> = {
  fishpulsu: 'Fish Pulusu.avif',
  gongurakodikoora: 'Gongura Chicken Curry.avif',
  guttivankayakoora: 'Guttivankaya Koora.avif',
  kuntakayakoora: 'Guttivankaya Koora.avif',
  hindifry: 'Bhindi Fry.avif',
  mirchikasaalan: 'Mirch ka Salan.avif',
  mirchikasalan: 'Mirch ka Salan.avif',
  karivepakukodivepudu: 'Karivepaku Kodi Vepudu.avif',
  chickendumbiryani: 'Chicken Biryani.avif',
  plainrice: 'Plain Rice.avif',
  vegmanchurian: 'Veg Manchuria.avif',
};

export function withLocalMenuImages<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => withLocalMenuImages(entry)) as T;
  }
  if (!value || typeof value !== 'object') return value;

  const record = value as Record<string, unknown>;
  const normalizedName =
    typeof record.name === 'string' ? normalizeMenuName(record.name) : undefined;
  const localImageByName = normalizedName
    ? localMenuImageByName[normalizedName]
    : undefined;
  const aliasFilename = normalizedName
    ? localMenuImageAliases[normalizedName]
    : undefined;
  const localImageByAlias = aliasFilename
    ? localMenuImageByName[
        normalizeMenuName(aliasFilename.replace(/\.avif$/i, ''))
      ]
    : undefined;
  const localImage = localImageByName ?? localImageByAlias;
  const enriched = Object.fromEntries(
    Object.entries(record).map(([key, entry]) => [
      key,
      withLocalMenuImages(entry),
    ]),
  );

  if (localImage) enriched.imageUrl = localImage;
  return enriched as T;
}
