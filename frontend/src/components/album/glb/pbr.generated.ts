// GENERATO da scratchpad/fetch-pbr.py — set PBR (ambientCG, CC0) per ogni materiale del catalogo.
export type PbrSet = { color?: string; normal?: string; rough?: string; repeat: number; roughness?: number; normalScale?: number; metalness?: number; sheen?: number; clearcoat?: number; clearcoatRoughness?: number; envMapIntensity?: number; tint?: boolean }
export const PBR: Record<string, PbrSet> = {
 'pelle': {
  'repeat': 0.55,
  'roughness': 0.62,
  'normalScale': 0.9,
  'clearcoat': 0.12,
  'clearcoatRoughness': 0.5,
  'color': '/textures/pbr/pelle/color.jpg',
  'normal': '/textures/pbr/pelle/normal.jpg',
  'rough': '/textures/pbr/pelle/rough.jpg'
 },
 'skill': {
  'repeat': 0.7,
  'roughness': 0.66,
  'normalScale': 0.8,
  'clearcoat': 0.1,
  'color': '/textures/pbr/skill/color.jpg',
  'normal': '/textures/pbr/skill/normal.jpg',
  'rough': '/textures/pbr/skill/rough.jpg'
 },
 'crazy': {
  'repeat': 0.5,
  'roughness': 0.78,
  'normalScale': 1.2,
  'color': '/textures/pbr/crazy/color.jpg',
  'normal': '/textures/pbr/crazy/normal.jpg',
  'rough': '/textures/pbr/crazy/rough.jpg'
 },
 'alcantara': {
  'repeat': 0.8,
  'roughness': 0.92,
  'normalScale': 0.9,
  'sheen': 0.55,
  'color': '/textures/pbr/alcantara/color.jpg',
  'normal': '/textures/pbr/alcantara/normal.jpg',
  'rough': '/textures/pbr/alcantara/rough.jpg'
 },
 'suade': {
  'repeat': 0.7,
  'roughness': 0.95,
  'normalScale': 1.2,
  'sheen': 0.7,
  'color': '/textures/pbr/suade/color.jpg',
  'normal': '/textures/pbr/suade/normal.jpg',
  'rough': '/textures/pbr/suade/rough.jpg'
 },
 'velu-arte': {
  'repeat': 0.8,
  'roughness': 0.9,
  'normalScale': 0.6,
  'sheen': 0.9,
  'color': '/textures/pbr/velu-arte/color.jpg',
  'normal': '/textures/pbr/velu-arte/normal.jpg',
  'rough': '/textures/pbr/velu-arte/rough.jpg'
 },
 'juta': {
  'repeat': 0.6,
  'roughness': 0.88,
  'normalScale': 1.1,
  'color': '/textures/pbr/juta/color.jpg',
  'normal': '/textures/pbr/juta/normal.jpg',
  'rough': '/textures/pbr/juta/rough.jpg'
 },
 'safir': {
  'repeat': 0.9,
  'roughness': 0.7,
  'normalScale': 0.7,
  'sheen': 0.35,
  'color': '/textures/pbr/safir/color.jpg',
  'normal': '/textures/pbr/safir/normal.jpg',
  'rough': '/textures/pbr/safir/rough.jpg'
 },
 'sequoia': {
  'repeat': 0.8,
  'roughness': 0.8,
  'normalScale': 0.8,
  'sheen': 0.3,
  'color': '/textures/pbr/sequoia/color.jpg',
  'normal': '/textures/pbr/sequoia/normal.jpg',
  'rough': '/textures/pbr/sequoia/rough.jpg'
 },
 'soft-touch': {
  'repeat': 0.5,
  'roughness': 0.95,
  'normalScale': 0.25,
  'color': '/textures/pbr/soft-touch/color.jpg',
  'normal': '/textures/pbr/soft-touch/normal.jpg',
  'rough': '/textures/pbr/soft-touch/rough.jpg'
 },
 'metal': {
  'repeat': 0.9,
  'roughness': 0.45,
  'normalScale': 0.6,
  'metalness': 0.55,
  'envMapIntensity': 1.3,
  'color': '/textures/pbr/metal/color.jpg',
  'normal': '/textures/pbr/metal/normal.jpg',
  'rough': '/textures/pbr/metal/rough.jpg'
 },
 'acero': {
  'repeat': 0.4,
  'roughness': 0.55,
  'normalScale': 0.5,
  'clearcoat': 0.2,
  'clearcoatRoughness': 0.3,
  'color': '/textures/pbr/acero/color.jpg',
  'normal': '/textures/pbr/acero/normal.jpg',
  'rough': '/textures/pbr/acero/rough.jpg'
 },
 'wood': {
  'repeat': 0.33,
  'roughness': 0.42,
  'normalScale': 0.35,
  'clearcoat': 0.3,
  'clearcoatRoughness': 0.25,
  'tint': false,
  'color': '/textures/pbr/wood/color.jpg',
  'normal': '/textures/pbr/wood/normal.jpg',
  'rough': '/textures/pbr/wood/rough.jpg'
 },
 'cristalwhite': {
  'repeat': 0.5,
  'roughness': 0.18,
  'normalScale': 0.1,
  'clearcoat': 0.9,
  'clearcoatRoughness': 0.08,
  'tint': false,
  'color': '/textures/pbr/cristalwhite/color.jpg',
  'normal': '/textures/pbr/cristalwhite/normal.jpg',
  'rough': '/textures/pbr/cristalwhite/rough.jpg'
 },
 'cristalplex': {
  'repeat': 0.5,
  'roughness': 0.12,
  'normalScale': 0.15,
  'clearcoat': 1.0,
  'clearcoatRoughness': 0.05,
  'color': '/textures/pbr/cristalplex/color.jpg',
  'normal': '/textures/pbr/cristalplex/normal.jpg',
  'rough': '/textures/pbr/cristalplex/rough.jpg'
 }
}
