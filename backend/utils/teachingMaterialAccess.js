// isEnabled defaults to true and is absent on materials that predate the
// field, so anything but an explicit `false` counts as enabled — a strict
// `isEnabled: true` check would wrongly hide every pre-existing material.
const partitionMaterialsByEnabled = (materials = []) => {
  const enabled = materials.filter((material) => material.isEnabled !== false);
  const disabledIds = materials
    .filter((material) => material.isEnabled === false)
    .map((material) => String(material._id));
  return { enabled, disabledIds };
};

module.exports = { partitionMaterialsByEnabled };
