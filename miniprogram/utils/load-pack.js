const loaders = {
  'shushan_effects_1': () => require.async('../packs/shushan_effects_1/ready.js'),
  'shushan_effects_2': () => require.async('../packs/shushan_effects_2/ready.js'),
  'shushan_music_1': () => require.async('../packs/shushan_music_1/ready.js'),
  'shushan_music_2': () => require.async('../packs/shushan_music_2/ready.js'),
  'shushan_music_3': () => require.async('../packs/shushan_music_3/ready.js'),
  'shushan_tiles_guozi_1': () => require.async('../packs/shushan_tiles_guozi_1/ready.js'),
  'shushan_tiles_normal_female_1': () => require.async('../packs/shushan_tiles_normal_female_1/ready.js'),
  'shushan_tiles_normal_male_1': () => require.async('../packs/shushan_tiles_normal_male_1/ready.js'),
  'shushan_tiles_sc_female_1': () => require.async('../packs/shushan_tiles_sc_female_1/ready.js'),
  'shushan_tiles_sc_male_1': () => require.async('../packs/shushan_tiles_sc_male_1/ready.js'),
  'shushan_voice_guozi_1': () => require.async('../packs/shushan_voice_guozi_1/ready.js'),
  'shushan_voice_normal_female_1': () => require.async('../packs/shushan_voice_normal_female_1/ready.js'),
  'shushan_voice_normal_male_1': () => require.async('../packs/shushan_voice_normal_male_1/ready.js'),
  'shushan_voice_sc_female_1': () => require.async('../packs/shushan_voice_sc_female_1/ready.js'),
  'shushan_voice_sc_male_1': () => require.async('../packs/shushan_voice_sc_male_1/ready.js')
};
module.exports = name => loaders[name] ? loaders[name]() : Promise.reject(new Error('未知音效包'));
