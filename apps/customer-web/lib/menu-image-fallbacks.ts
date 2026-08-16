const localMenuImageById: Readonly<Record<string, string>> = {
  '4149198e-5812-4935-9395-b745f23191f0': '/menu-images/starters/apollo-fish/large.jpg',
  '2c7518dc-9add-432d-a48d-8c4af6ae9573': '/menu-images/starters/baby-corn-manchurian/large.jpg',
  '19195ab1-f4c5-41db-b5c0-6bb8fb4547f4': '/menu-images/starters/chicken-majestic/large.jpg',
  '45fce211-d308-46e4-9eb1-3222f374cd97': '/menu-images/starters/chicken-tikka/large.jpg',
  '0b86d7cc-3b77-4f7d-bef0-0d49fbf6ae23': '/menu-images/starters/chicken-65/large.jpg',
  'da9c11a1-3788-4df2-b31b-b4ec087ba62f': '/menu-images/starters/chiilli-prawns/large.jpg',
  '356fe1ba-48e6-4cd3-9e3a-907dc04d2df6': '/menu-images/starters/chilli-chicken/large.jpg',
  '9d7ebe3d-8a29-4e3b-ae06-1a8e61cbf664': '/menu-images/starters/chilli-egg/large.jpg',
  'fe899a28-a145-496f-8df5-2e27fe1f4f18': '/menu-images/starters/chilli-mushroom/large.jpg',
  '5aa582c4-8e75-45ea-a6d1-e4942c5325c9': '/menu-images/starters/chilli-paneer/large.jpg',
  '0c106db1-15f1-4498-96f5-7492b1bac318': '/menu-images/starters/crispy-baby-corn/large.jpg',
  '1e30ab25-d62b-46d6-9818-7df2df78a6bc': '/menu-images/starters/fish-tikka/large.jpg',
  '61e46ef4-228d-4eef-b15b-1e97eb01791d': '/menu-images/starters/gobi-manchurian/large.jpg',
  '661f1c88-8295-40c5-8807-0e5273ac8196': '/menu-images/starters/karivepaku-kodi-vepudu/large.jpg',
  'cdf0a9f0-142e-4591-8401-76244af6bef9': '/menu-images/starters/mamsam-jeddipapu-fry/large.jpg',
  'aa11cb72-91cc-4a77-81fb-e6f361684ae2': '/menu-images/starters/paneer-majestic/large.jpg',
  '770d1d27-e6da-480d-991e-126cf84d2e45': '/menu-images/starters/paneer-65/large.jpg',
  '7de32455-1cef-43cc-af29-d54045c249c4': '/menu-images/starters/pepper-chicken/large.jpg',
  '01dba703-afa2-4f59-916f-6a5d32adab74': '/menu-images/starters/veg-manchurian/large.jpg',
  '0717461e-a6bb-4228-896a-68c3d84e617d': '/menu-images/indian-breads/butter-naan/large.jpg',
  '72899c99-082b-4e35-b36d-9afbbd029be0': '/menu-images/indian-breads/garlic-naan/large.jpg',
  'efa45e04-431e-41fc-a87e-d8c769617d6c': '/menu-images/indian-breads/phulka/large.jpg',
  '20891f71-8ff7-47c3-8abb-5c038d45af7e': '/menu-images/indian-breads/plain-naan/large.jpg',
  '6e4acbf6-7735-4af5-b69d-2c2b8842c2b7': '/menu-images/indian-breads/tandoori-roti/large.jpg',
  '86658231-b0a0-4d13-8db0-643633b191a0': '/menu-images/curry/aloo-dum-curry/large.jpg',
  '759b929c-dab6-40af-ba5e-8e039161143e': '/menu-images/curry/aloo-gobi-masala/large.jpg',
  '4f886cdd-ec10-4dd4-9c3b-a2f5facdaf73': '/menu-images/curry/butter-chicken/large.jpg',
  '689b4593-80b3-4143-a815-1f6860e68fb1': '/menu-images/curry/chicken-kholapuri/large.jpg',
  '61edcbe0-6201-4404-963d-020f60d6ace5': '/menu-images/curry/chicken-tikka-masala/large.jpg',
  '485813a7-1d53-4681-b187-c122154f1f1e': '/menu-images/curry/dal-fry/large.jpg',
  'dc069421-98f6-4f37-b0e0-f6fdf1ccb337': '/menu-images/curry/dal-tadka/large.jpg',
  '739fe68d-dd4f-4789-b50a-69eec86e3f7a': '/menu-images/curry/egg-bhurji/large.jpg',
  'bc4b6c81-21e7-4a52-baaa-4eeed3231701': '/menu-images/curry/fish-pulsu/large.jpg',
  'ab794867-02cb-4879-b174-e6263726b0f0': '/menu-images/curry/fish-tikka-masala/large.jpg',
  '105255f3-b439-4685-b001-71e94f733888': '/menu-images/curry/gongura-kodi-koora/large.jpg',
  'e12d8cdc-7c6b-4679-86e4-05a77c2d2583': '/menu-images/curry/guttivankaya-koora/large.jpg',
  'dd43bd56-8b5a-4fcb-8780-0fa4f212c875': '/menu-images/curry/kadai-chicken/large.jpg',
  'b07e1f28-be5b-4879-89b0-609d537e41ba': '/menu-images/curry/kadai-paneer/large.jpg',
  'cbd92630-4888-44f5-aabe-fdcf754773d4': '/menu-images/curry/kadai-veg/large.jpg',
  '30e59cba-484c-4f45-8646-46637306c983': '/menu-images/curry/kodi-koora/large.jpg',
  '1f689b95-09e8-4039-87e7-422cc59a5ae0': '/menu-images/curry/lucknowi-mutton-korma/large.jpg',
  'c8d932a7-9fdf-4cd3-aeab-5c1cc4ab956c': '/menu-images/curry/mix-veg/large.jpg',
  '2c7f9e3e-0819-4a18-a1ed-740664bece53': '/menu-images/curry/mushroom-masala/large.jpg',
  '6e315edb-dc7d-456d-881f-e75239dcf993': '/menu-images/curry/mutton-masala/large.jpg',
  'd3d465ee-1873-4fda-8f9e-ec0fef50d82b': '/menu-images/curry/mutton-rogan-josh/large.jpg',
  'f9c8504b-aea3-41e7-a072-8888a974f0ba': '/menu-images/curry/nizami-handi/large.jpg',
  'f275d276-55ed-4fb2-b325-8bee81cb0efd': '/menu-images/curry/paneer-butter-masala/large.jpg',
  '196ee1ef-196b-4af4-a999-f4812eb91d11': '/menu-images/curry/paneer-kholapuri/large.jpg',
  '2ed0b1f8-c769-4d00-9e97-7d473283e195': '/menu-images/curry/paneer-tikka-masala/large.jpg',
  'eb485dbf-c3aa-49ce-bb05-e0803f1df36e': '/menu-images/curry/veg-kholapuri/large.jpg',
  '12de4a99-c51f-44ae-a33f-d4a0c8475387': '/menu-images/biryani/chicken-biryani/large.jpg',
  '9bca4a3e-3219-4d47-bf6b-cf3e8052f509': '/menu-images/biryani/egg-biryani/large.jpg',
  'c4e158a0-da00-412e-b602-2bf5d39bc115': '/menu-images/biryani/mutton-dum-biryani/large.jpg',
  '5be40e22-930b-4668-871e-f7a55e4dcd62': '/menu-images/biryani/veg-biryani/large.jpg',
  'f029ddf1-c926-417e-b8e5-250a54ab1fe9': '/menu-images/rice-items/bagara-rice/large.jpg',
  '246085fe-d08b-442f-b3eb-9e1ba8c6e0bc': '/menu-images/rice-items/chicken-fried-rice/large.jpg',
  '30940702-ffe6-45e1-a66c-a8457f78c071': '/menu-images/rice-items/curd-rice/large.jpg',
  'e4dd9d78-a03c-4e39-b15e-a2f5e2263844': '/menu-images/rice-items/egg-fried-rice/large.jpg',
  'da85a3fd-104b-4045-81c5-cda4ec3d455f': '/menu-images/rice-items/jeera-rice/large.jpg',
  '48f99754-1daa-4096-9da4-f5e47fb67a46': '/menu-images/rice-items/plain-rice/large.jpg',
  '08b85580-b11b-491c-a319-b6155c4f7975': '/menu-images/rice-items/sambar-rice/large.jpg',
  '2d2e848b-7be2-4f1d-8d0b-09a20c2f942f': '/menu-images/rice-items/veg-fried-rice/large.jpg',
  '753514d8-a912-4cf4-a952-0ab6b45da759': '/menu-images/desserts/double-ka-meetha/large.jpg',
  '712e7cd3-131d-4acc-a68a-3231169b35ab': '/menu-images/desserts/gulab-jamun/large.jpg',
  'e43764a6-a674-44b7-b164-23ed153196d0': '/menu-images/desserts/kala-jamun/large.jpg',
};

export function withLocalMenuImages<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => withLocalMenuImages(entry)) as T;
  }
  if (!value || typeof value !== 'object') return value;

  const record = value as Record<string, unknown>;
  const localImage =
    typeof record.id === 'string' ? localMenuImageById[record.id] : undefined;
  const enriched = Object.fromEntries(
    Object.entries(record).map(([key, entry]) => [
      key,
      withLocalMenuImages(entry),
    ]),
  );

  if (localImage && !record.imageUrl) enriched.imageUrl = localImage;
  return enriched as T;
}

