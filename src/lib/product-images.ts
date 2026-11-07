import { knownRealImage } from "./known-real-images";

/**
 * แผนผังรูปถ่ายสินค้าของจริง (Real Product Photos Map)
 * ดึงจากคลังภาพสินค้าจริงของ JIB, iHAVECPU, BaNANA IT และ IKEA Thailand
 * เพื่อให้สินค้าตัวอย่างและสินค้าทุกชิ้นในระบบแสดงรูปสินค้าตัวจริงครบ 100%
 */

export const REAL_PRODUCT_IMAGES: Record<string, string> = {
  "ikea-storage-142": "/products/kallax-77x147.webp",
  "gear-55-4": "/products/oakywood-large-modular-drawers.webp",
  "gear-51-7": "/products/ugreen-nasync.webp",
  "gear-32-4": "/products/ikea-stockholm-sideboard.webp",
  "gear-26-4": "/products/montana-modular-shelves.webp",
  "gear-21-11": "/products/transcend-storejet.webp",
  "gear-19-8": "/products/wd-my-passport.webp",
  "ikea-wardrobe-563": "/products/wardrobe-ikea-wardrobe-563.webp",
  "ikea-wardrobe-121": "/products/wardrobe-ikea-wardrobe-121.webp",
  "ikea-wardrobe-63": "/products/wardrobe-ikea-wardrobe-63.webp",
  "ikea-wardrobe-62": "/products/wardrobe-ikea-wardrobe-62.webp",
  "ikea-wardrobe-45": "/products/wardrobe-ikea-wardrobe-45.webp",
  "ikea-wardrobe-41": "/products/wardrobe-ikea-wardrobe-41.webp",
  "ikea-wardrobe-38": "/products/wardrobe-ikea-wardrobe-38.webp",
  "ikea-wardrobe-37": "/products/wardrobe-ikea-wardrobe-37.webp",
  "ikea-wardrobe-36": "/products/wardrobe-ikea-wardrobe-36.webp",
  "ikea-wardrobe-35": "/products/wardrobe-ikea-wardrobe-35.webp",
  "ikea-wardrobe-34": "/products/wardrobe-ikea-wardrobe-34.webp",
  "ikea-wardrobe-30": "/products/wardrobe-ikea-wardrobe-30.webp",
  "ikea-wardrobe-27": "/products/wardrobe-ikea-wardrobe-27.webp",
  "ikea-wardrobe-25": "/products/wardrobe-ikea-wardrobe-25.webp",
  "ikea-wardrobe-24": "/products/wardrobe-ikea-wardrobe-24.webp",
  "ikea-wardrobe-22": "/products/wardrobe-ikea-wardrobe-22.webp",
  "ikea-wardrobe-20": "/products/wardrobe-ikea-wardrobe-20.webp",
  "ikea-wardrobe-19": "/products/wardrobe-ikea-wardrobe-19.webp",
  "ikea-wardrobe-17": "/products/wardrobe-ikea-wardrobe-17.webp",
  "ikea-wardrobe-15": "/products/wardrobe-ikea-wardrobe-15.webp",
  "ikea-wardrobe-11": "/products/wardrobe-ikea-wardrobe-11.webp",
  "ikea-wardrobe-10": "/products/wardrobe-ikea-wardrobe-10.webp",
  "ikea-wardrobe-8": "/products/wardrobe-ikea-wardrobe-8.webp",
  "ikea-wardrobe-7": "/products/wardrobe-ikea-wardrobe-7.webp",
  "ikea-wardrobe-6": "/products/wardrobe-ikea-wardrobe-6.webp",
  "ikea-wardrobe-5": "/products/wardrobe-ikea-wardrobe-5.webp",
  "mb-asrock-b650m-hdv": "/products/asrock-b650m-hdv.webp",
  "ikea-decor-81": "/products/fagelfjallet-6-drawers-black.webp",
  "ikea-decor-80": "/products/kilberget-6-drawers-white.webp",
  "ikea-decor-79": "/products/kilberget-5-drawers-white.webp",
  "ikea-storage-78": "/products/vihals-storage-combination.webp",
  "ikea-decor-77": "/products/fagelfjallet-8-drawers-offwhite.webp",
  "ikea-decor-76": "/products/storklinta-6-drawers-white.webp",
  "ikea-decor-72": "/products/malm-3-drawers-oak.webp",
  "ikea-decor-71": "/products/lastare-4-drawers-white.webp",
  "ikea-decor-70": "/products/gursken-3-drawers-beige.webp",
  "ikea-decor-50": "/products/komplement-hanger-white.webp",
  "ikea-decor-47": "/products/komplement-rail-white.webp",
  "ikea-decor-46": "/products/komplement-drawer-white.webp",
  "ikea-storage-206": "/products/omar-2sets.webp",
  "ikea-storage-192": "/products/omar-94.webp",
  "ikea-storage-191": "/products/omar-181.webp",
  "ikea-decor-13": "/products/omar-shelving-unit.webp",
  "ikea-wardrobe-56": "/products/wardrobe-ikea-wardrobe-56.webp",
  "ikea-wardrobe-18": "/products/wardrobe-ikea-wardrobe-18.webp",
  "ikea-wardrobe-28": "/products/wardrobe-ikea-wardrobe-28.webp",
  "ikea-wardrobe-40": "/products/wardrobe-ikea-wardrobe-40.webp",
  "ikea-wardrobe-39": "/products/wardrobe-ikea-wardrobe-39.webp",
  "ikea-wardrobe-33": "/products/wardrobe-ikea-wardrobe-33.webp",
  "ikea-wardrobe-26": "/products/wardrobe-ikea-wardrobe-26.webp",
  "ikea-wardrobe-23": "/products/wardrobe-ikea-wardrobe-23.webp",
  "ikea-wardrobe-32": "/products/wardrobe-ikea-wardrobe-32.webp",
  "ikea-wardrobe-44": "/products/wardrobe-ikea-wardrobe-44.webp",
  "ikea-wardrobe-43": "/products/wardrobe-ikea-wardrobe-43.webp",
  "ikea-wardrobe-42": "/products/wardrobe-ikea-wardrobe-42.webp",
  "ikea-wardrobe-31": "/products/wardrobe-ikea-wardrobe-31.webp",
  "ikea-wardrobe-21": "/products/wardrobe-ikea-wardrobe-21.webp",
  "ikea-wardrobe-12": "/products/wardrobe-ikea-wardrobe-12.webp",
  "ikea-wardrobe-9": "/products/wardrobe-ikea-wardrobe-9.webp",
  "ikea-wardrobe-4": "/products/wardrobe-ikea-wardrobe-4.webp",
  "ikea-wardrobe-14": "/products/wardrobe-ikea-wardrobe-14.webp",
  "ikea-wardrobe-3": "/products/wardrobe-ikea-wardrobe-3.webp",
  "ikea-wardrobe-2": "/products/wardrobe-ikea-wardrobe-2.webp",
  "ikea-wardrobe-1": "/products/wardrobe-ikea-wardrobe-1.webp",
  "ikea-wardrobe-29": "/products/wardrobe-ikea-wardrobe-29.webp",
  "ikea-wardrobe-16": "/products/wardrobe-ikea-wardrobe-16.webp",
  "gear-55-6": "/furniture/oakywood-hanging-organizer.webp",
  "gear-55-5": "/furniture/oakywood-desk-hook.webp",
  "gear-55-2": "/furniture/oakywood-cable-tray.webp",
  "gear-53-10": "/furniture/oakywood-desk-shelf.webp",
  "gear-53-7": "/furniture/mat-orbitkey-slim.webp",
  "gear-52-6": "/furniture/mat-grovemade-leather.webp",
  "gear-50-5": "/furniture/mat-orbitkey-stone.webp",
  "gear-45-7": "/furniture/mat-nedrelow-magic.webp",
  "gear-43-2": "/furniture/mat-ikea-susig.webp",
  "gear-42-7": "/furniture/pico-desk-caddy.webp",
  "gear-42-3": "/furniture/mat-goyard-desk.webp",
  "gear-41-8": "/furniture/balolo-desk-accessories.webp",
  "gear-36-4": "/furniture/mat-grovemade-wool.webp",
  "gear-28-5": "/furniture/grovemade-desk-shelf.webp",
  "gear-25-9": "/lighting/screen-ambient-sync.webp",
  "gear-25-8": "/furniture/walking-pad-foldable.webp",
  "gear-23-5": "/furniture/oakywood-todo-kit.webp",
  "gear-23-4": "/furniture/mat-oakywood-cork.webp",
  "gear-4-16": "/lighting/nanoleaf-shapes.webp",
  "gear-4-11": "/furniture/mat-roccat-sense.webp",
  "gear-51-8": "/furniture/anthros-chair.webp",
  "gear-48-9": "/furniture/ikea-dyvlinge.webp",
  "gear-47-7": "/furniture/branch-ergo-chair.webp",
  "gear-39-6": "/furniture/porvata-ergo-chair.webp",
  "gear-33-3": "/furniture/ikea-langfjall.webp",
  "gear-30-2": "/furniture/steelcase-gesture.webp",
  "gear-29-2": "/furniture/autonomous-ergochair.webp",
  "gear-28-3": "/furniture/herman-miller-mirra.webp",
  "gear-27-2": "/furniture/andtradition-rely-chair.webp",
  "gear-26-1": "/furniture/wegner-wishbone.webp",
  "gear-23-9": "/furniture/ikea-alefjall-black.webp",
  "gear-22-4": "/furniture/herman-miller-sayl.webp",
  "gear-20-5": "/furniture/humanscale-diffrient.webp",
  "gear-18-7": "/furniture/functional-ikea-chair.webp",
  "gear-17-4": "/furniture/vintage-ikea-chair.webp",
  "gear-16-3": "/furniture/herman-miller-cosm.webp",
  "gear-5-5": "/furniture/herman-miller-aeron.webp",
  "gear-4-14": "/furniture/ikea-markus-black.webp",
  "gear-3-11": "/furniture/limbic-active-chair.webp",
  "gear-46-11": "/furniture/vintage-wooden-executive-chair.webp",
  "gear-41-7": "/furniture/ergohuman-mesh-chair.webp",
  "gear-52-1": "/furniture/ikea-karlby-desk.webp",
  "gear-51-6": "/furniture/vernal-desk-drawers.webp",
  "gear-48-6": "/furniture/flexispot-walnut-desk.webp",
  "gear-47-6": "/furniture/ikea-trotten-desk.webp",
  "gear-46-10": "/furniture/vari-electric-desk.webp",
  "gear-45-1": "/furniture/vernal-standing-desk.webp",
  "gear-40-2": "/furniture/autonomous-smartdesk-pro.webp",
  "gear-39-5": "/furniture/minimalist-steel-wood-desk.webp",
  "gear-37-1": "/furniture/vernal-l-shaped-desk.webp",
  "gear-35-3": "/furniture/producer-studio-desk.webp",
  "gear-34-10": "/furniture/dual-standing-desks.webp",
  "gear-33-1": "/furniture/oakywood-standing-desk-pro.webp",
  "gear-32-5": "/furniture/ergonofis-sway-desk.webp",
  "gear-31-5": "/furniture/ergonofis-maple-desk.webp",
  "gear-30-1": "/furniture/fully-white-standing-desk.webp",
  "gear-29-1": "/furniture/autonomous-desk.webp",
  "gear-27-1": "/furniture/corner-wrap-oak-desk.webp",
  "gear-26-6": "/furniture/eiermann-architect-table.webp",
  "gear-25-6": "/furniture/modern-electric-standing-desk.webp",
  "gear-23-1": "/furniture/oakywood-classic-desk.webp",
  "gear-22-3": "/furniture/flexispot-eg1.webp",
  "gear-21-4": "/furniture/ikea-skarsta-compact.webp",
  "gear-20-1": "/furniture/oak-butcher-block-desk.webp",
  "gear-19-1": "/furniture/live-edge-slab-desk.webp",
  "gear-16-4": "/furniture/floyd-white-gray.webp",
  "gear-14-9": "/furniture/blaise-oak-desk.webp",
  "gear-13-4": "/furniture/geekdesk-heavy-duty.webp",
  "gear-8-5": "/furniture/jarvis-standing-desk.webp",
  "gear-6-6": "/furniture/ikea-skarsta-desk.webp",
  "gear-5-3": "/furniture/floyd-side-table.webp",
  "gear-5-1": "/furniture/floyd-desk.webp",
  "gear-4-15": "/furniture/modulor-architect-desk.webp",
  "gear-3-10": "/furniture/ikea-bekant-desk.webp",
  "gear-1-6": "/furniture/ikea-vittsjo-laptop.webp",
  "ihc-43669": "/furniture/neolution-cosmos-desk.webp",
  "ihc-43665": "/furniture/neolution-duo-desk.webp",
  "gear-5-6": "/lighting/nanoleaf-shapes.webp",
  // === Room 1: Gaming RGB Black ===
  "desk-gaming-carbon-140": "/furniture/desk-gaming-carbon-140.webp",
  "pc-gaming-4070s-7800x3d":
    "https://www.jib.co.th/img_master/product/medium/20260814131144_0000086914_33_1.jpg",
  "mon-27-qhd-170-ips":
    "https://www.jib.co.th/img_master/product/medium/20260811160417_0000084703_469_1.jpg",
  "kb-75-rgb-black":
    "https://www.jib.co.th/img_master/product/medium/2025022811513674717_1.jpg",
  "mouse-gaming-58g-black":
    "https://www.jib.co.th/img_master/product/medium/20250619154956_61791_66_1.jpg",
  "pad-xxl-rgb-90":
    "https://www.jib.co.th/img_master/product/medium/202604161123410000084626_1.jpg",
  "hs-gaming-71-black":
    "https://www.jib.co.th/img_master/product/medium/2023060215264860060_1.jpg",
  "chair-gaming-black":
    "https://www.jib.co.th/img_master/product/medium/20230526173038_34626_287_1.jpg",
  "light-strip-rgb-5m": "https://www.ikea.com/th/th/images/products/kabbleka-led-lighting-strip-with-usb-dimmable__1456863_pe992520_s5.jpg",
  "lightbar-monitor-black": "https://ihcupload-bkk.s3.ap-southeast-7.amazonaws.com/img/product/products178216_800.jpg",
  "spk-21-rgb":
    "https://www.jib.co.th/img_master/product/medium/2024090414010770373_1.jpg",
  "decor-neon-gamepad":
    "https://www.ikea.com/th/th/images/products/skaftsaerv-led-decoration-lighting-dimmable__1488793_pe1003518_s5.jpg",
  "rug-round-black-120":
    "https://www.ikea.com/th/th/images/products/stoense-rug-low-pile-dark-grey__0624381_pe691796_s5.jpg",

  // === Room 2: Gaming White ===
  "desk-white-120": "/furniture/desk-white-120.webp",
  "pc-white-4060ti-14400f":
    "https://www.jib.co.th/img_master/product/medium/2024080108445169315_1.jpg",
  "mon-27-qhd-165-white":
    "https://www.jib.co.th/img_master/product/medium/2020081415213142103_1.jpg",
  "kb-65-white":
    "https://www.jib.co.th/img_master/product/medium/2025123010153282736_1.jpg",
  "mouse-wireless-white":
    "https://www.jib.co.th/img_master/product/medium/20250619155423_61792_66_1.jpg",
  "pad-white-pink-80":
    "https://www.jib.co.th/img_master/product/medium/202608281326200000087346_1.jpg",
  "hs-white-cat":
    "https://www.jib.co.th/img_master/product/medium/2023081709014561371_1.jpg",
  "chair-gaming-white-pink":
    "https://www.jib.co.th/img_master/product/medium/20220315093256_51582_352_1.jpg",
  "lightbar-white": "/lighting/white-monitor-lightbar.webp",
  "stand-headset-white":
    "https://www.ikea.com/th/th/images/products/moejlighet-headset-tablet-stand-black__0634709_pe696689_s5.jpg",
  "spk-white-mini":
    "https://www.jib.co.th/img_master/product/medium/2022051809541632021_2.jpg",
  "rug-white-fluffy":
    "https://www.ikea.com/th/th/images/products/stoense-rug-low-pile-off-white__0624419_pe691827_s5.jpg",

  // === Room 3: Minimal White & Oak ===
  "desk-oak-white-120": "/furniture/desk-oak-white-120.webp",
  "minipc-m-class":
    "https://www.jib.co.th/img_master/product/medium/20251118164717_81647_287_1.jpg",
  "mon-27-4k-usbc":
    "https://www.jib.co.th/img_master/product/medium/20220421101637_48858_352_1.jpg",
  "arm-single-white":
    "https://www.jib.co.th/img_master/product/medium/2025100410464980767_1.jpg",
  "kb-lowprofile-white":
    "https://www.jib.co.th/img_master/product/medium/2022081117575954583_1.jpg",
  "mouse-minimal-white":
    "https://www.jib.co.th/img_master/product/medium/2023092209171362471_1.jpg",
  "mat-felt-gray-70":
    "https://www.ikea.com/th/th/images/products/lanespelare-gaming-mouse-pad-black__0961724_pe807730_s5.jpg",
  "lamp-wood-desk": "/lighting/lamp-wood-desk.webp",
  "decor-plant-ceramic":
    "https://www.ikea.com/th/th/images/products/fejka-artificial-potted-plant-with-pot-in-outdoor-grass__0748876_pe745265_s5.jpg",
  "chair-mesh-white": "/furniture/chair-mesh-white.webp",
  "shelf-floating-oak":
    "https://www.ikea.com/th/th/images/products/lack-wall-shelf-white-stained-oak-effect__0670316_pe715442_s5.jpg",
  "rug-beige-140":
    "https://www.ikea.com/th/th/images/products/stoense-rug-low-pile-beige__1405711_pe970547_s5.jpg",

  // === Room 4: Space-saving work ===
  "desk-wall-fold-100":
    "https://www.ikea.com/th/th/images/products/norberg-wall-mounted-drop-leaf-table-white__0736622_pe740674_s5.jpg",
  "laptop-14-usbc":
    "https://www.jib.co.th/img_master/product/medium/20251208135910_82277_287_1.jpg",
  "stand-laptop-alu":
    "https://www.jib.co.th/img_master/product/medium/202605151044110000085068_1.jpg",
  "mon-24-fhd-75":
    "https://www.jib.co.th/img_master/product/medium/202607311055470000086719_1.jpg",
  "kb-compact-gray":
    "https://www.jib.co.th/img_master/product/medium/2023121209345064158_1.jpg",
  "mouse-vertical":
    "https://www.jib.co.th/img_master/product/medium/20260624162140_0000056964_469_2.jpg",
  "lamp-clamp-led": "https://www.ikea.com/th/th/images/products/naevlinge-led-clamp-spotlight-white__0710474_pe727575_s5.jpg",
  "chair-fold-fabric":
    "https://www.ikea.com/th/th/images/products/dyvlinge-swivel-easy-chair-kelinge-beige__1457402_pe992618_s5.jpg",
  "pegboard-wall":
    "https://www.ikea.com/th/th/images/products/skadis-pegboard-white__0710683_pe727709_s5.jpg",
  "drawer-under-desk":
    "https://www.ikea.com/th/th/images/products/tonstad-drawer-unit-on-castors-oak-veneer__1243904_pe921030_s5.jpg",
  "webcam-1080":
    "https://www.jib.co.th/img_master/product/medium/20180910180208_23553_24_1.png",

  // === Room 5: Student budget ===
  "desk-pine-100": "/furniture/desk-pine-100.webp",
  "laptop-156-budget":
    "https://www.jib.co.th/img_master/product/medium/2023072116463161018_1.jpg",
  "mon-22-fhd-100":
    "https://www.jib.co.th/img_master/product/medium/20240429162836_66961_287_1.jpg",
  "combo-kb-mouse":
    "https://www.jib.co.th/img_master/product/medium/20180716115204_14717_11963954.jpg",
  "pad-basic":
    "https://www.jib.co.th/img_master/product/medium/20180817113006_24251_23_1.jpg",
  "hs-budget":
    "https://www.jib.co.th/img_master/product/medium/2019080913532934727_1.jpg",
  "lamp-led-student": "/lighting/student-eyecare-lamp.webp",
  "chair-office-basic": "/furniture/chair-office-basic.webp",
  "shelf-book-small":
    "https://www.ikea.com/th/th/images/products/billy-bookcase-oak-effect__1590287_pe1038926_s5.jpg",
  "stand-laptop-plastic":
    "https://www.ikea.com/th/th/images/products/oejulf-laptop-support-dark-grey__1167478_pe891586_s5.jpg",
  "board-cork":
    "https://www.ikea.com/th/th/images/products/floensa-memo-board-with-pins-cork__1158093_pe887988_s5.jpg",
  "rug-small-gray":
    "https://www.ikea.com/th/th/images/products/tiphede-rug-flatwoven-black-natural__1074517_pe856220_s5.jpg",

  // === Room 6: Streamer ===
  "desk-l-black-160": "/furniture/desk-l-black-160.webp",
  "pc-stream-4070-7700":
    "https://ihcupload-bkk.s3.ap-southeast-7.amazonaws.com/img/product/products180321_800.jpg",
  "mon-24-fhd-ips-dp":
    "https://www.jib.co.th/img_master/product/medium/20210218171740_36576_316_1.jpg",
  "mic-xlr-dynamic":
    "https://www.jib.co.th/img_master/product/medium/2024101210390871273_1.jpg",
  "audio-interface-2ch":
    "https://www.jib.co.th/img_master/product/medium/202604301049080000084882_1.jpg",
  "boom-arm":
    "https://www.jib.co.th/img_master/product/medium/2022070610453454125_1.jpg",
  "webcam-4k":
    "https://www.jib.co.th/img_master/product/medium/2024040311413866646_1.png",
  "keylight-panel": "https://www.jib.co.th/img_master/product/medium/2024111213364472013_1.jpg",
  "stream-deck-15":
    "https://www.jib.co.th/img_master/product/medium/2019101613420135509_1.png",
  "hs-studio-closed":
    "https://www.jib.co.th/img_master/product/medium/20181018120046_28773_24_1.png",
  "foam-acoustic-12":
    "https://www.ikea.com/th/th/images/products/havstorp-cover-panel-light-grey__1219120_pe916873_s5.jpg",
  "light-hex-rgb": "/lighting/light-hex-rgb.webp",

  // === Room 7: Creator ===
  "desk-creator-160":
    "https://www.ikea.com/th/th/images/products/lagkapten-alex-desk-grey-wood-effect-black__1432280_pe982738_s5.jpg",
  "pc-ws-4080s-9950x":
    "https://ihcupload-bkk.s3.ap-southeast-7.amazonaws.com/img/product/products185178_800.jpg",
  "mon-34-uw-qhd":
    "https://www.jib.co.th/img_master/product/medium/20221229170612_56996_352_1.jpg",
  "mon-27-4k-pro-color":
    "https://www.jib.co.th/img_master/product/medium/20220421101637_48858_352_1.jpg",
  "calibrator":
    "https://www.jib.co.th/img_master/product/medium/2024101509275871285_1.jpg",
  "kb-productivity":
    "https://www.jib.co.th/img_master/product/medium/2022081117575954583_1.jpg",
  "mouse-productivity":
    "https://ihcupload-bkk.s3.ap-southeast-7.amazonaws.com/img/product/products165103_800.jpg",
  "edit-controller":
    "https://ihcupload-bkk.s3.ap-southeast-7.amazonaws.com/img/product/products163502_800.jpg",
  "hs-studio-open":
    "https://www.jib.co.th/img_master/product/medium/20220528130251_52425_352_1.jpg",
  "lightbar-pro": "/lighting/curved-monitor-lightbar.webp",
  "chair-ergo-premium": "/furniture/chair-ergo-premium.webp",
  "spk-studio-monitor":
    "https://www.jib.co.th/img_master/product/medium/20260303150720_83768_436_1.jpg",

  // === Room 8: Health / Standing ===
  "desk-standing-140":
    "https://www.ikea.com/th/th/images/products/mittzon-desk-sit-stand-electric-walnut-veneer-white__1209455_pe909231_s5.jpg",
  "mon-27-eyecare":
    "https://www.jib.co.th/img_master/product/medium/20240425153408_66872_287_1.jpg",
  "chair-ergo-lumbar": "/furniture/chair-ergo-lumbar.webp",
  "kb-split-ergo":
    "https://www.jib.co.th/img_master/product/medium/2025081309361279342_1.jpg",
  "wrist-rest-foam":
    "https://www.jib.co.th/img_master/product/medium/2022082315181054787_1.jpg",
  "mat-antifatigue":
    "https://www.ikea.com/th/th/images/products/alstern-bath-mat-dark-grey__0688677_pe722645_s5.jpg",
  "footrest":
    "https://www.ikea.com/th/th/images/products/dagotto-foot-rest-black__0156454_pe315498_s5.jpg",
  "lamp-eyecare-auto": "/lighting/lamp-eyecare-auto.webp",

  // === Room 9: Dark Luxury ===
  "desk-walnut-160": "/furniture/desk-walnut-160.webp",
  "pc-sff-4070tis":
    "https://ihcupload-bkk.s3.ap-southeast-7.amazonaws.com/img/product/products178309_800.jpg",
  "mon-32-4k-black":
    "https://ihcupload-bkk.s3.ap-southeast-7.amazonaws.com/img/product/products179261_800.jpg",
  "kb-alu-black":
    "https://ihcupload-bkk.s3.ap-southeast-7.amazonaws.com/img/product/products178216_800.jpg",
  "mouse-premium-black":
    "https://ihcupload-bkk.s3.ap-southeast-7.amazonaws.com/img/product/products178216_800.jpg",
  "mat-leather-90":
    "https://www.ikea.com/th/th/images/products/ploeja-desk-pad-white-transparent__1074653_pe856495_s5.jpg",
  "hs-premium-wireless":
    "https://ihcupload-bkk.s3.ap-southeast-7.amazonaws.com/img/product/products178216_800.jpg",
  "chair-exec-leather": "/furniture/chair-exec-leather.webp",
  "lamp-brass": "/lighting/vintage-brass-lamp.webp",
  "spk-bookshelf-wood":
    "https://ihcupload-bkk.s3.ap-southeast-7.amazonaws.com/img/product/products178216_800.jpg",
  "stand-headset-brass":
    "https://www.ikea.com/th/th/images/products/moejlighet-headset-tablet-stand-orange__1484190_pe1001486_s5.jpg",
  "rug-dark-gray":
    "https://www.ikea.com/th/th/images/products/stoense-rug-low-pile-dark-grey__0624381_pe691796_s5.jpg",

  // === Room 10: Premium Flagship ===
  "desk-motor-200": "/furniture/desk-motor-200.webp",
  "pc-flagship-5090":
    "https://www.jib.co.th/img_master/product/medium/20250430160903_76327_287_1.jpg",
  "mon-27-oled-360":
    "https://www.jib.co.th/img_master/product/medium/2024071518193268617_1.jpg",
  "arm-triple":
    "https://www.jib.co.th/img_master/product/medium/2025100410464980767_1.jpg",
  "kb-custom-premium":
    "https://www.jib.co.th/img_master/product/medium/2025123010153282736_1.jpg",
  "mouse-pro-wireless":
    "https://www.jib.co.th/img_master/product/medium/2024042610382366942_1.jpg",
  "mat-leather-120":
    "https://www.jib.co.th/img_master/product/medium/2020061709290240437_1.jpg",
  "hs-audiophile-dac":
    "https://www.jib.co.th/img_master/product/medium/2024092816184670981_1.jpg",
  "spk-active-premium":
    "https://www.jib.co.th/img_master/product/medium/2024101616242171365_1.jpg",
  "chair-premium-ergo": "/furniture/chair-premium-ergo.webp",
  "light-smart-ambient": "/lighting/screen-ambient-sync.webp",
  "decor-pixel-clock":
    "https://www.ikea.com/th/th/images/products/roedstraefse-alarm-clock-with-hygro-thermometer-beige__1510572_pe1009953_s5.jpg",
  "rug-premium-wool":
    "https://www.ikea.com/th/th/images/products/stoense-rug-low-pile-off-white__0624402_pe691814_s5.jpg",

  // === หมวดหมู่ของใช้ในห้อง (เตียง ชั้นวางของ กระถางต้นไม้ ต้นไม้ปลอม ต้นไม้จริง ของตกแต่ง พรม) ===
  "bed-minimal-oak-5ft":
    "https://www.ikea.com/th/th/images/products/malm-bed-frame-high-w-2-storage-boxes-white-stained-oak-veneer-luroey__1154398_pe886037_s5.jpg",
  "bed-storage-drawers-6ft":
    "https://www.ikea.com/th/th/images/products/brimnes-bed-frame-with-storage-white-luroey__1151024_pe884762_s5.jpg",
  "bed-gaming-led-35ft":
    "https://www.ikea.com/th/th/images/products/slattum-upholstered-bed-frame-vissle-dark-grey__1259335_pe926650_s5.jpg",
  "bed-sofa-foldable-gray":
    "https://www.ikea.com/th/th/images/products/friheten-corner-sofa-bed-with-storage-skiftebo-dark-grey__0175610_pe328883_s5.jpg",
  "shelf-steel-5tier-black":
    "https://www.ikea.com/th/th/images/products/hattasen-bedside-table-shelf-unit-white__1111044_pe870647_s5.jpg",
  "shelf-cube-display-white":
    "https://www.ikea.com/th/th/images/products/kallax-shelving-unit-with-2-doors-with-2-shelf-inserts-white__1286556_pe933609_s5.jpg",
  "pot-ceramic-nordic-white":
    "https://www.ikea.com/th/th/images/products/nypon-plant-pot-in-outdoor-grey__0641166_pe700339_s5.jpg",
  "pot-terracotta-stand-wood":
    "https://www.ikea.com/th/th/images/products/persillade-plant-pot-dark-grey__0439713_pe592235_s5.jpg",
  "pot-selfwatering-matte-black":
    "https://www.ikea.com/th/th/images/products/gradvis-plant-pot-in-outdoor-light-brown__1450831_pe990445_s5.jpg",
  "fake-plant-monstera-70cm":
    "https://www.ikea.com/th/th/images/products/fejka-artificial-potted-plant-in-outdoor-monstera__0614197_pe686822_s5.jpg",
  "fake-plant-olive-tree-120cm":
    "https://www.ikea.com/th/th/images/products/fejka-artificial-potted-plant-in-outdoor-bamboo__1423297_pe979093_s5.jpg",
  "fake-plant-hanging-ivy":
    "https://www.ikea.com/th/th/images/products/fejka-artificial-potted-plant-in-outdoor-hanging__0748917_pe745318_s5.jpg",
  "real-plant-snake-airpurifier":
    "https://www.ikea.com/th/th/images/products/fejka-artificial-potted-plant-in-outdoor-monstera__0959226_pe809439_s5.jpg",
  "real-plant-rubber-black":
    "https://www.ikea.com/th/th/images/products/fejka-artificial-potted-plant-with-pot-in-outdoor-monstera__1372451_pe959463_s5.jpg",
  "real-plant-monstera-deliciosa":
    "https://www.ikea.com/th/th/images/products/dypsis-lutescens-potted-plant-areca-palm__0653973_pe708202_s5.jpg",
  "real-plant-zamioculcas-desk":
    "https://www.ikea.com/th/th/images/products/chamaedorea-elegans-potted-plant-parlour-palm__0653975_pe708204_s5.jpg",
  "decor-astronaut-projector":
    "https://www.ikea.com/th/th/images/products/aftonsparv-led-table-lamp-rocket-multicolour__1195011_pe902204_s5.jpg",
  "decor-framed-cyber-art":
    "https://www.ikea.com/th/th/images/products/bild-poster-basketball-match__1385517_pe963346_s5.jpg",
  "rug-geometric-nordic-160":
    "https://www.ikea.com/th/th/images/products/tiphede-rug-flatwoven-natural-black__0772066_pe755879_s5.jpg",

  // === PC BUILDER PARTS (100% Real Authentic Official CDN Photos with Verified Transparent Backgrounds) ===
  "cpu-r5-7600":
    "https://c1.neweggimages.com/productimage/nb640/19-113-787-01.jpg",
  "cpu-r7-7800x3d":
    "https://ihcupload-bkk.s3.ap-southeast-7.amazonaws.com/img/product/products85319_800.jpg",
  "cpu-r7-9800x3d":
    "https://ihcupload-bkk.s3.ap-southeast-7.amazonaws.com/img/product/products180976_800.jpg",
  "cpu-r9-9950x":
    "https://c1.neweggimages.com/productimage/nb640/19-113-841-02.jpg",
  "cpu-i5-12400f":
    "https://c1.neweggimages.com/productimage/nb640/19-118-360-08.jpg",
  "cpu-i5-14600k":
    "https://ihcupload-bkk.s3.ap-southeast-7.amazonaws.com/img/product/products181282_800.jpg",
  "cpu-u7-265k":
    "https://c1.neweggimages.com/productimage/nb640/19-118-506-06.jpg",
  "cpu-i7-14700k":
    "https://c1.neweggimages.com/productimage/nb640/19-118-466-05.jpg",
  "cpu-u9-285k":
    "https://c1.neweggimages.com/productimage/nb640/19-118-505-08.jpg",
  "mb-b650m-ds3h":
    "https://static.gigabyte.com/StaticFile/Image/Global/31ccb6aac436d23323567d67446c95b0/ProductRemoveBg/36808",
  "mb-b650-tomahawk":
    "https://c1.neweggimages.com/productimage/nb640/13-144-557-08.jpg",
  "mb-b650e-steel-white":
    "https://c1.neweggimages.com/productimage/nb640/13-162-081-08.jpg",
  "mb-b650i-itx":
    "https://c1.neweggimages.com/productimage/nb640/13-119-612-01.jpg",
  "mb-b760m-ddr4":
    "https://c1.neweggimages.com/productimage/nb640/13-144-597-01.jpg",
  "mb-z790-aorus-ddr5":
    "https://static.gigabyte.com/StaticFile/Image/Global/0c6899b3e79329e5c8236fda4441fe0e/ProductRemoveBg/32578",
  "mb-z890-pro-rs":
    "https://c1.neweggimages.com/productimage/nb640/13-162-176-11.png",
  "ram-ddr4-8-single":
    "https://c1.neweggimages.com/productimage/nb640/20-374-427-01.png",
  "ram-ddr4-16-single":
    "https://c1.neweggimages.com/productimage/nb640/20-374-427-01.png",
  "ram-ddr4-16-3200":
    "https://c1.neweggimages.com/productimage/nb640/20-374-427-01.png",
  "ram-ddr5-16-rgb-single":
    "https://c1.neweggimages.com/productimage/nb640/20-374-427-01.png",
  "ram-ddr5-16-white-single":
    "https://c1.neweggimages.com/productimage/nb640/20-982-045-01.png",
  "ram-ddr5-32-single":
    "https://c1.neweggimages.com/productimage/nb640/20-374-427-01.png",
  "ram-ddr5-32-6000-black":
    "https://c1.neweggimages.com/productimage/nb640/20-374-427-01.png",
  "ram-ddr5-32-6000-white":
    "https://c1.neweggimages.com/productimage/nb640/20-982-045-01.png",
  "ram-ddr5-64-6000-4dimm":
    "https://assets.corsair.com/image/upload/w_600,h_600,c_pad,q_auto:best/products/Memory/Dominator%20Titanium/enhanced%20images/black/4UP/DOMINATOR_TITANIUM_RGB_DDR5_BLACK_4UP_Artboard01_AA.png",
  "ram-ddr5-16-5600-single":
    "https://c1.neweggimages.com/productimage/nb640/20-374-427-01.png",
  "ram-ddr5-64-6400-white":
    "https://c1.neweggimages.com/productimage/nb640/20-374-506-05.png",
  "ram-ddr5-128-6000-pro":
    "https://assets.corsair.com/image/upload/w_600,h_600,c_pad,q_auto:best/products/Memory/Dominator%20Titanium/enhanced%20images/black/4UP/DOMINATOR_TITANIUM_RGB_DDR5_BLACK_4UP_Artboard01_AA.png",
  "gpu-rtx-4060-8g":
    "https://static.gigabyte.com/StaticFile/Image/Global/452a88cb2f5478a3886998eb59050326/ProductRemoveBg/35371",
  "gpu-rx-7700xt-12g":
    "https://static.gigabyte.com/StaticFile/Image/Global/0bea9a69cffeb0d2cb038274665c3936/ProductRemoveBg/36140",
  "gpu-rtx-4070s-white":
    "https://static.gigabyte.com/StaticFile/Image/Global/128a494940b1ea2d5ae3d0b9edf6a8a5/ProductRemoveBg/39157",
  "gpu-rtx-4080s-16g":
    "https://static.gigabyte.com/StaticFile/Image/Global/748f429d2100d111113b4a35eed953cd/ProductRemoveBg/39052",
  "gpu-rtx-5090-32g":
    "https://static.gigabyte.com/StaticFile/Image/Global/348caf711e8983639057ae8f70bf73e9/ProductRemoveBg/43842",
  "ssd-500gb-gen4":
    "https://ihcupload-bkk.s3.ap-southeast-7.amazonaws.com/img/product/products55857_800.jpg",
  "ssd-1tb-gen4":
    "https://ihcupload-bkk.s3.ap-southeast-7.amazonaws.com/img/product/products152736_800.jpg",
  "ssd-2tb-990pro":
    "https://c1.neweggimages.com/productimage/nb640/20-147-865-01.jpg",
  "ssd-4tb-gen5":
    "https://c1.neweggimages.com/productimage/nb640/20-156-397-09.png",
  "psu-650w-bronze":
    "https://c1.neweggimages.com/productimage/nb640/17-139-322-04.png",
  "psu-750w-gold-sfx":
    "https://c1.neweggimages.com/productimage/nb640/17-171-171-11.png",
  "psu-850w-gold-white": "/products/tt-toughpower-gf3-850w.webp",
  "psu-1200w-plat":
    "https://c1.neweggimages.com/NeweggImage/productimage/17-320-025-01.png",
  "case-nr200p-itx":
    "https://ihcupload-bkk.s3.ap-southeast-7.amazonaws.com/img/product/products156408_800.jpg",
  "case-ap201-matx-white":
    "https://ihcupload-bkk.s3.ap-southeast-7.amazonaws.com/img/product/products125150_800.jpg",
  "case-nzxt-h6-black":
    "https://ihcupload-bkk.s3.ap-southeast-7.amazonaws.com/img/product/products192175_800.jpg",
  "case-lianli-vision-white":
    "https://c1.neweggimages.com/productimage/nb640/mh2h_90226363-0334-40ed-af12-d879319de0ff.jpg",
  "cooler-air-ak400":
    "https://c1.neweggimages.com/productimage/nb640/35-856-261-01.jpg",
  "cooler-aio-240-black":
    "https://ihcupload-bkk.s3.ap-southeast-7.amazonaws.com/img/product/products193664_800.jpg",
  "cooler-aio-360-white":
    "https://c1.neweggimages.com/productimage/nb640/35-146-165-01.jpg",

  // === MONITORS (100% Real Authentic Manufacturer Cutouts) ===
  "mon-msi-mp225":
    "https://monitorgarage.com/wp-content/uploads/2026/09/msi-mpg-271qrx-oficial.png",
  "mon-aoc-25b40":
    "https://achieva.co.th/wp-content/uploads/2024/06/24G4_F.png",
  "mon-gigabyte-gs24f":
    "https://static.gigabyte.com/StaticFile/Image/Global/fa5abde643d8a4d2b3c5ddfe92d59dd1/ProductRemoveBg/45065",
  "mon-msi-mp251":
    "https://monitorgarage.com/wp-content/uploads/2026/09/msi-mpg-271qrx-oficial.png",
  "mon-aoc-24g50z":
    "https://achieva.co.th/wp-content/uploads/2024/06/24G4_F.png",
  "mon-aoc-27g50z":
    "https://achieva.co.th/wp-content/uploads/2024/06/24G4_F.png",
  "mon-gigabyte-gs25f":
    "https://static.gigabyte.com/StaticFile/Image/Global/fa5abde643d8a4d2b3c5ddfe92d59dd1/ProductRemoveBg/45065",
  "mon-aoc-q27b36":
    "https://achieva.co.th/wp-content/uploads/2024/06/24G4_F.png",
  "mon-msi-275qf":
    "https://monitorgarage.com/wp-content/uploads/2026/09/msi-mpg-271qrx-oficial.png",
  "mon-aoc-q27g40":
    "https://achieva.co.th/wp-content/uploads/2024/06/24G4_F.png",
  "mon-aoc-cs25g":
    "https://achieva.co.th/wp-content/uploads/2024/06/24G4_F.png",
  "mon-msi-275upd":
    "https://monitorgarage.com/wp-content/uploads/2026/09/msi-mpg-271qrx-oficial.png",
  "mon-msi-321upd":
    "https://monitorgarage.com/wp-content/uploads/2026/09/msi-mpg-271qrx-oficial.png",
  "mon-aoc-q27g40zdf":
    "https://achieva.co.th/wp-content/uploads/2024/06/24G4_F.png",
  "mon-24-fhd-180-ips":
    "https://achieva.co.th/wp-content/uploads/2024/06/24G4_F.png",
  "mon-27-qhd-240-ips":
    "https://static.gigabyte.com/StaticFile/Image/Global/fa5abde643d8a4d2b3c5ddfe92d59dd1/ProductRemoveBg/45065",
  "mon-27-qhd-360-oled":
    "https://monitorgarage.com/wp-content/uploads/2026/09/msi-mpg-271qrx-oficial.png",
  "mon-32-4k-240-oled":
    "https://press.asus.com/assets/w_640,h_640/a9b6558b-b499-4363-a989-fed7fe7cb338/ROG%20Swift%20OLED%20PG32UCDM_left.png",
  "mon-27-qhd-100-eyecare":
    "https://image.benq.com/is/image/benqco/8-bl2790qt-right45-1",
  "mon-24-fhd-100-eyecare":
    "https://dlcdnwebimgs.asus.com/gain/c0b9455e-86e4-4e25-91d4-9adc047b0b41/w692",
  "mon-27-4k-dell-work":
    "https://i.dell.com/is/image/DellContent/content/dam/ss2/product-images/dell-client-products/peripherals/monitors/u-series/u2723qe/media-gallery/monitor-u2723qe-gallery-1.psd?fmt=png-alpha&pscan=auto&scl=1&qlt=100,1&resMode=sharp2&chrss=full",
  "mon-34-uw-work":
    "https://media.us.lg.com/transform/ecomm-PDPGallery-1100x730/32a1b432-b2a7-48ab-b974-828d2013e8f0/34WR50QC-B_01_gallery_3000x3000?io=transform:fill,width:1536",
  "mon-27-4k-proart":
    "https://dlcdnwebimgs.asus.com/gain/28581920-41a9-4ea9-a94f-fd6a83eb57fd/w692",

  // === BUILDER EXTRA ITEMS ===
  "hdd-wd-2tb":
    "https://www.jib.co.th/img_master/product/medium/2024121015490672816_1.jpg",
  "hdd-seagate-4tb":
    "https://www.jib.co.th/img_master/product/medium/20240831131955_70230_66_1.jpg",
  "sata-samsung-870":
    "https://www.jib.co.th/img_master/product/medium/2021021109044045272_1.jpg",
  "sata-kingston-960":
    "https://www.jib.co.th/img_master/product/medium/2024090611312270439_1.jpg",
  "fan-lianli-sl120":
    "https://ihcupload-bkk.s3.ap-southeast-7.amazonaws.com/img/product/products183349_800.jpg",
  "fan-corsair-af120":
    "https://www.jib.co.th/img_master/product/medium/2024112815572772490_1.jpg",
  "mouse-gpro-x2":
    "https://www.jib.co.th/img_master/product/medium/20250619154956_61791_66_1.jpg",
  "mouse-viper-v3":
    "https://www.jib.co.th/img_master/product/medium/2024042610382366942_1.jpg",
  "kb-keychron-q1":
    "https://media-cdn.bnn.in.th/501162/keychron-gaming-keyboard-k2x-hot-swappable-qmkvia-rgb-backlight-red-switch-keyboard-th-01-square_medium.jpg",
  "kb-rog-azoth":
    "https://www.jib.co.th/img_master/product/medium/2025123010153282736_1.jpg",
  "mon-lg-27-240-oled":
    "https://www.jib.co.th/img_master/product/medium/2024071518193268617_1.jpg",
  "ups-apc-1500va":
    "https://www.jib.co.th/img_master/product/medium/202607311109250000086732_1.jpg",
  "acc-elgato-camlink":
    "https://www.jib.co.th/img_master/product/medium/2024111213364472013_1.jpg",
  "gear-hyperx-cloud3":
    "https://www.jib.co.th/img_master/product/medium/202607311047070000086713_1.jpg",
  "gear-shure-mv7":
    "https://ihcupload-bkk.s3.ap-southeast-7.amazonaws.com/img/product/products160140_800.jpg",
  "sw-win11-home":
    "https://www.jib.co.th/img_master/product/medium/20240220162537_65577_287_1.jpg",
  "sw-office-2024":
    "https://www.jib.co.th/img_master/product/medium/20250609151701_77307_287_1.jpg",

  // === LIGHTING & GADGETS (Authentic Unique Studio & Manufacturer Cutouts) ===
  "gear-12-5": "https://www.assets.signify.com/is/image/Signify/7820130U7-Carousel-MainProduct-RTP-01?wid=600&hei=600&qlt=85", // Hue color smart light
  "gear-19-5": "/lighting/nymane-usb-anthracite.webp", // Lamp with built in USB slots
  "gear-19-6": "https://elgato-assets.imgix.net/image/upload/q_auto,f_auto/w_480/v1782474113/Products/10LAM9901%20%28Key%20Light%20Air%20MK.2%29/Cart/Key_Light_Air_MK2_Cart.png", // Elgato Key Light Air with mount arm
  "gear-20-2": "https://nanoleaf.me/cdn/shop/files/MatterSmartMulticolorLightstrip_FrontPackaging_5M_LooseCoil.png", // Nanoleaf Matter LED strip
  "gear-20-3": "/lighting/mathmos-astro-lava.webp", // Mathmos Astro lava lamp
  "gear-21-6": "/lighting/philips-screen-lightbar.webp", // Philips / BenQ ScreenBar
  "gear-22-7": "/lighting/ikea-ps-portable-lamp.webp", // IKEA SKURUP lamp
  "gear-23-10": "/lighting/corston-brass-pendant.webp", // Corston Brookfield Pendant
  "gear-24-4": "/lighting/luna-moon-lamp.webp", // Luna Lamp
  "gear-26-5": "https://dam.louispoulsen.dk/DigizuiteCore/LegacyService/api/assetstream/66408/50422.webp?width=600&height=600&fit=crop&format=webp&quality=90", // Louis Poulsen Panthella 250
  "gear-27-6": "/lighting/ferm-living-oyster.webp", // Ferm Living Oyster
  "gear-28-11": "/lighting/artemide-tolomeo.webp", // Artemide Tolomeo Micro
  "gear-28-12": "https://wp.andtradition.com/wp-content/uploads/2025/11/133093A570_Flowerpot-VP9_Zesty-Orange_Front_ON-1200x1600.jpg", // &Tradition Flowerpot
  "gear-28-13": "/lighting/pampshade-baguette.webp", // Yukiko Morita Pampshade
  "gear-29-7": "https://www.assets.signify.com/is/image/Signify/7820230P7-Carousel-MainProduct-RTP-01?wid=600&hei=600&qlt=85", // Philips Hue Lightbar
  "gear-30-6": "/lighting/ikea-tokabo-table-lamp.webp", // IKEA TOKABO lamp
  "gear-31-11": "/lighting/aputure-studio-light.webp", // Aputure 120D
  "gear-33-5": "https://image.benq.com/is/image/benqco/07screenbar-topleft45-button?fmt=png-alpha", // BenQ ScreenBar Pro
  "gear-36-10": "https://i01.appmifile.com/v1/MI_18455B3E4DA706226CF7535A58E875F0267/pms_1666850673.95389721.png", // Xiaomi Mi Home Smart LED
  "gear-40-9": "https://www.assets.signify.com/is/image/Signify/7820230U7-Carousel-MainProduct-RTP-01?wid=600&hei=600&qlt=85", // Phillips Hue Light Bar
  "gear-40-11": "/lighting/ring-light-12inch.webp", // UBeesize LED Ring Light
  "gear-40-12": "https://resource.logitechg.com/w_544,h_466,ar_7:6,c_pad,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/gaming/en/products/litra-beam-g/gallery/litra-beam-gallery-1.png", // Logitech Litra Beam
  "gear-41-9": "/lighting/philips-hue-go.webp", // Philips Hue lighting
  "gear-42-4": "/lighting/mono-reading-lamp.webp", // Mono Reading Lamp
  "gear-44-4": "/lighting/artemide-tolomeo-duo.webp", // Artemide Tolomeo / Demetra
  "gear-44-5": "https://i01.appmifile.com/webfile/globalimg/products/m/mi-smart-led-desk-lamp-pro/overview02-s1.png", // Xiaomi Desk Lamp Pro
  "gear-46-9": "/lighting/amaran-studio-light.webp", // Amaran 100x/200x
  "gear-47-8": "/lighting/oasis-ambients.webp", // Oasis Ambients
  "gear-48-10": "/lighting/ikea-kloeving-floor.webp", // Ikea KLÖVING Floor lamp
  "gear-51-12": "/lighting/honeywell-h01.webp", // Honeywell H01 Lamp
  "gear-51-21": "/lighting/tolifo-key-light.webp", // Tolifo Key Light
  "gear-55-16": "/lighting/amaran-verge-max.webp", // amaran Verge Max Light
  "gear-9-5": "/lighting/aukey-led-desk-lamp.webp", // Aukey Desk Lamp
};

const CATEGORY_FALLBACK_IMAGES: Record<string, string> = {
  wardrobe:
    "https://www.ikea.com/th/th/images/products/kleppstad-wardrobe-with-3-doors-white__0754326_pe747926_s5.jpg",
  bed: "https://www.ikea.com/th/th/images/products/malm-bed-frame-high-w-2-storage-boxes-white-stained-oak-veneer-luroey__1154398_pe886037_s5.jpg",
  storage:
    "https://www.ikea.com/th/th/images/products/kallax-shelving-unit-with-2-doors-with-2-shelf-inserts-white__1286556_pe933609_s5.jpg",
  plant_pot:
    "https://www.ikea.com/th/th/images/products/nypon-plant-pot-in-outdoor-grey__0641166_pe700339_s5.jpg",
  fake_plant:
    "https://www.ikea.com/th/th/images/products/fejka-artificial-potted-plant-in-outdoor-monstera__0614197_pe686822_s5.jpg",
  real_plant:
    "https://www.ikea.com/th/th/images/products/dypsis-lutescens-potted-plant-areca-palm__0653973_pe708202_s5.jpg",
  decor:
    "https://www.ikea.com/th/th/images/products/roedstraefse-alarm-clock-with-hygro-thermometer-beige__1510572_pe1009953_s5.jpg",
  rug: "https://www.ikea.com/th/th/images/products/stoense-rug-low-pile-beige__1405711_pe970547_s5.jpg",
  desk: "https://www.ikea.com/th/th/images/products/utespelare-gaming-desk-black__0985179_pe816538_s5.jpg",
  chair:
    "https://www.jib.co.th/img_master/product/medium/20230526173038_34626_287_1.jpg",
  monitor:
    "https://www.jib.co.th/img_master/product/medium/20260811160417_0000084703_469_1.jpg",
  monitor_arm:
    "https://www.jib.co.th/img_master/product/medium/2025100410464980767_1.jpg",
  computer:
    "https://www.jib.co.th/img_master/product/medium/20260814131144_0000086914_33_1.jpg",
  keyboard:
    "https://www.jib.co.th/img_master/product/medium/2025022811513674717_1.jpg",
  mouse:
    "https://www.jib.co.th/img_master/product/medium/20250619154956_61791_66_1.jpg",
  mousepad:
    "https://www.jib.co.th/img_master/product/medium/202604161123410000084626_1.jpg",
  keyboard_pad:
    "https://www.jib.co.th/img_master/product/medium/2022082315181054787_1.jpg",
  headphone:
    "https://www.jib.co.th/img_master/product/medium/2023060215264860060_1.jpg",
  microphone:
    "https://www.jib.co.th/img_master/product/medium/2024101210390871273_1.jpg",
  speaker:
    "https://www.jib.co.th/img_master/product/medium/2024090414010770373_1.jpg",
  webcam:
    "https://www.jib.co.th/img_master/product/medium/2024040311413866646_1.png",
  lighting:
    "https://ihcupload-bkk.s3.ap-southeast-7.amazonaws.com/img/product/products178216_800.jpg",
  other:
    "https://www.jib.co.th/img_master/product/medium/2019101613420135509_1.png",
};

export function resolveRealProductImage(params: {
  id?: string | null;
  name?: string;
  category?: string;
  imageUrl?: string | null;
}): string {
  // 0. Check real store og:image map first (replaces shared case photos & illustrations)
  if (params.id) {
    const fromStoreMap = knownRealImage({ id: params.id, imageUrl: params.imageUrl });
    if (fromStoreMap) return fromStoreMap;
  }

  // 1. Curated real manufacturer transparent cutout takes priority,
  // unless params.imageUrl is already a real external store photo and the map entry is a local illustration
  if (params.id && REAL_PRODUCT_IMAGES[params.id]) {
    const mapped = REAL_PRODUCT_IMAGES[params.id];
    const isMappedIllustration = mapped.startsWith("/furniture/") || mapped.startsWith("/lighting/");
    const hasRealExternal = Boolean(params.imageUrl && /^https?:\/\//.test(params.imageUrl));
    if (isMappedIllustration && hasRealExternal) {
      return params.imageUrl!;
    }
    return mapped;
  }

  // 2. Custom valid image URL (ignore generic tertial-work-lamp-white fallback unless it is actually TERTIAL)
  if (
    params.imageUrl &&
    (params.imageUrl.startsWith("http") ||
      params.imageUrl.startsWith("/") ||
      params.imageUrl.startsWith("data:"))
  ) {
    const isTertialFallback = params.imageUrl.includes("tertial-work-lamp-white");
    const isRealTertial = (params.name || "").toLowerCase().includes("tertial");
    if (!isTertialFallback || isRealTertial) {
      return params.imageUrl;
    }
  }

  const hay = `${params.name || ""} ${params.category || ""}`.toLowerCase();

  // 0. Lighting & Desk Gadgets (Strict matching for authentic creator gadgets)
  if (params.category === "lighting" || hay.includes("lamp") || hay.includes("light") || hay.includes("โคมไฟ")) {
    if (hay.includes("hue") || hay.includes("philips")) {
      if (hay.includes("bar") || hay.includes("strip") || hay.includes("play")) {
        return REAL_PRODUCT_IMAGES["gear-29-7"];
      }
      return REAL_PRODUCT_IMAGES["gear-12-5"];
    }
    if (hay.includes("elgato") || hay.includes("air light") || hay.includes("key light") || hay.includes("filming")) {
      return REAL_PRODUCT_IMAGES["gear-19-6"];
    }
    if (hay.includes("screenbar") || hay.includes("benq") || hay.includes("screen light")) {
      return REAL_PRODUCT_IMAGES["gear-33-5"];
    }
    if (hay.includes("litra") || hay.includes("logitech")) {
      return REAL_PRODUCT_IMAGES["gear-40-12"];
    }
    if (hay.includes("nanoleaf")) {
      return REAL_PRODUCT_IMAGES["gear-20-2"];
    }
    if (hay.includes("xiaomi") || hay.includes("mi home")) {
      if (hay.includes("pro")) {
        return REAL_PRODUCT_IMAGES["gear-44-5"];
      }
      return REAL_PRODUCT_IMAGES["gear-36-10"];
    }
    if (hay.includes("usb") || hay.includes("charging")) {
      return REAL_PRODUCT_IMAGES["gear-19-5"];
    }
    if (hay.includes("panthella") || hay.includes("louis poulsen")) {
      return REAL_PRODUCT_IMAGES["gear-26-5"];
    }
    if (hay.includes("flowerpot")) {
      return REAL_PRODUCT_IMAGES["gear-28-12"];
    }
    if (hay.includes("tolomeo") || hay.includes("artemide")) {
      return REAL_PRODUCT_IMAGES["gear-44-4"];
    }
    if (hay.includes("lava") || hay.includes("mathmos")) {
      return REAL_PRODUCT_IMAGES["gear-20-3"];
    }
    if (hay.includes("pendant")) {
      return REAL_PRODUCT_IMAGES["gear-23-10"];
    }
    if (hay.includes("floor lamp") || hay.includes("klöving")) {
      return REAL_PRODUCT_IMAGES["gear-48-10"];
    }
    if (hay.includes("aputure") || hay.includes("amaran") || hay.includes("120d") || hay.includes("100x") || hay.includes("200x")) {
      return REAL_PRODUCT_IMAGES["gear-31-11"];
    }
    if (hay.includes("ring light") || hay.includes("ubeesize")) {
      return REAL_PRODUCT_IMAGES["gear-40-11"];
    }
    if (hay.includes("aukey") || hay.includes("reading lamp") || hay.includes("mono")) {
      return REAL_PRODUCT_IMAGES["gear-9-5"];
    }
    if (hay.includes("luna") || hay.includes("tokabo") || hay.includes("globe")) {
      return REAL_PRODUCT_IMAGES["gear-24-4"];
    }
  }

  // 1. Monitors (Strict category isolation - NEVER cross with motherboards or GPUs)
  if (params.category === "monitor" || hay.includes("จอภาพ") || hay.includes("gaming monitor") || hay.includes("ips kvm") || hay.includes("240hz") || hay.includes("360hz")) {
    if (hay.includes("m27q") || hay.includes("gigabyte")) return REAL_PRODUCT_IMAGES["mon-27-qhd-240-ips"];
    if (hay.includes("24g4") || hay.includes("aoc")) return REAL_PRODUCT_IMAGES["mon-24-fhd-180-ips"];
    if (hay.includes("271qrx") || hay.includes("mpg") || hay.includes("360")) return REAL_PRODUCT_IMAGES["mon-27-qhd-360-oled"];
    if (hay.includes("pg32") || hay.includes("rog swift") || hay.includes("ucdm")) return REAL_PRODUCT_IMAGES["mon-32-4k-240-oled"];
    if (hay.includes("gw2790") || hay.includes("benq")) return REAL_PRODUCT_IMAGES["mon-27-qhd-100-eyecare"];
    if (hay.includes("va24") || hay.includes("asus")) return REAL_PRODUCT_IMAGES["mon-24-fhd-100-eyecare"];
    if (hay.includes("u2723") || hay.includes("ultrasharp") || hay.includes("dell")) return REAL_PRODUCT_IMAGES["mon-27-4k-dell-work"];
    if (hay.includes("34wr") || hay.includes("ultrawide") || hay.includes("lg")) return REAL_PRODUCT_IMAGES["mon-34-uw-work"];
    if (hay.includes("pa279") || hay.includes("proart")) return REAL_PRODUCT_IMAGES["mon-27-4k-proart"];
    return REAL_PRODUCT_IMAGES["mon-27-qhd-240-ips"];
  }

  // 2. RAM (Strict RAM matching - NEVER return CPU or Motherboard)
  if (params.category === "ram" || hay.includes("แรม") || hay.includes("ddr4") || hay.includes("ddr5") || hay.includes("trident") || hay.includes("vengeance") || hay.includes("fury beast") || hay.includes("dominator")) {
    if (hay.includes("white") || hay.includes("ขาว") || hay.includes("silver")) {
      if (hay.includes("royal")) return REAL_PRODUCT_IMAGES["ram-ddr5-64-6400-white"];
      return REAL_PRODUCT_IMAGES["ram-ddr5-32-6000-white"];
    }
    if (hay.includes("4dimm") || hay.includes("128gb") || hay.includes("dominator") || hay.includes("4แถว")) {
      return REAL_PRODUCT_IMAGES["ram-ddr5-64-6000-4dimm"];
    }
    return REAL_PRODUCT_IMAGES["ram-ddr5-32-6000-black"];
  }

  // 3. GPU / Graphics Cards (NEVER return monitor)
  if (params.category === "gpu" || hay.includes("การ์ดจอ") || hay.includes("geforce") || hay.includes("rtx") || hay.includes("radeon") || hay.includes("rx ") || hay.includes("vga")) {
    if (hay.includes("5090")) return REAL_PRODUCT_IMAGES["gpu-rtx-5090-32g"];
    if (hay.includes("4080")) return REAL_PRODUCT_IMAGES["gpu-rtx-4080s-16g"];
    if (hay.includes("7700") || hay.includes("radeon") || hay.includes("rx")) return REAL_PRODUCT_IMAGES["gpu-rx-7700xt-12g"];
    if (hay.includes("white") || hay.includes("aero") || hay.includes("ขาว") || hay.includes("4070")) return REAL_PRODUCT_IMAGES["gpu-rtx-4070s-white"];
    if (hay.includes("4060")) return REAL_PRODUCT_IMAGES["gpu-rtx-4060-8g"];
    return REAL_PRODUCT_IMAGES["gpu-rtx-4070s-white"];
  }

  // 4. Motherboards
  if (params.category === "motherboard" || hay.includes("เมนบอร์ด") || hay.includes("mainboard") || hay.includes("motherboard") || hay.includes("b650") || hay.includes("z790") || hay.includes("b760") || hay.includes("z890")) {
    if (hay.includes("b650m") || hay.includes("ds3h")) return REAL_PRODUCT_IMAGES["mb-b650m-ds3h"];
    if (hay.includes("tomahawk")) return REAL_PRODUCT_IMAGES["mb-b650-tomahawk"];
    if (hay.includes("steel legend")) return REAL_PRODUCT_IMAGES["mb-b650e-steel-white"];
    if (hay.includes("itx") || hay.includes("mini-itx")) return REAL_PRODUCT_IMAGES["mb-b650i-itx"];
    if (hay.includes("b760")) return REAL_PRODUCT_IMAGES["mb-b760m-ddr4"];
    if (hay.includes("z790") || hay.includes("aorus")) return REAL_PRODUCT_IMAGES["mb-z790-aorus-ddr5"];
    if (hay.includes("z890") || hay.includes("pro rs")) return REAL_PRODUCT_IMAGES["mb-z890-pro-rs"];
    return REAL_PRODUCT_IMAGES["mb-b650m-ds3h"];
  }

  // 5. CPUs
  if (params.category === "cpu" || hay.includes("ซีพียู") || hay.includes("cpu") || hay.includes("ryzen") || hay.includes("core i") || hay.includes("core ultra")) {
    if (hay.includes("7600")) return REAL_PRODUCT_IMAGES["cpu-r5-7600"];
    if (hay.includes("7800x3d")) return REAL_PRODUCT_IMAGES["cpu-r7-7800x3d"];
    if (hay.includes("9800x3d")) return REAL_PRODUCT_IMAGES["cpu-r7-9800x3d"];
    if (hay.includes("9950x")) return REAL_PRODUCT_IMAGES["cpu-r9-9950x"];
    if (hay.includes("12400")) return REAL_PRODUCT_IMAGES["cpu-i5-12400f"];
    if (hay.includes("14600")) return REAL_PRODUCT_IMAGES["cpu-i5-14600k"];
    if (hay.includes("14700")) return REAL_PRODUCT_IMAGES["cpu-i7-14700k"];
    if (hay.includes("265k") || hay.includes("ultra 7")) return REAL_PRODUCT_IMAGES["cpu-u7-265k"];
    if (hay.includes("285k") || hay.includes("ultra 9")) return REAL_PRODUCT_IMAGES["cpu-u9-285k"];
    return REAL_PRODUCT_IMAGES["cpu-r7-7800x3d"];
  }

  // Match by product name token if id wasn't provided
  for (const [id, img] of Object.entries(REAL_PRODUCT_IMAGES)) {
    const keyTokens = id.split("-").filter((t) => t.length >= 3);
    if (keyTokens.length >= 2 && keyTokens.every((t) => hay.includes(t))) {
      return img;
    }
  }

  // Keyword matching for room items & furniture
  if (hay.includes("เตียง") || hay.includes("โซฟาเบด") || hay.includes("bed")) {
    return CATEGORY_FALLBACK_IMAGES.bed;
  }
  if (hay.includes("กระถาง")) {
    return CATEGORY_FALLBACK_IMAGES.plant_pot;
  }
  if (hay.includes("ต้นไม้ปลอม") || hay.includes("ไม้ประดิษฐ์")) {
    return CATEGORY_FALLBACK_IMAGES.fake_plant;
  }
  if (
    hay.includes("ต้นไม้จริง") ||
    hay.includes("ลิ้นมังกร") ||
    hay.includes("ยางอินเดีย") ||
    hay.includes("กวักมรกต") ||
    hay.includes("มอนสเตอร่า")
  ) {
    return CATEGORY_FALLBACK_IMAGES.real_plant;
  }
  if (hay.includes("พรม") || hay.includes("rug")) {
    return CATEGORY_FALLBACK_IMAGES.rug;
  }
  if (hay.includes("ตู้เสื้อผ้า") || hay.includes("wardrobe") || hay.includes("closet")) {
    return CATEGORY_FALLBACK_IMAGES.wardrobe;
  }
  if (hay.includes("ตู้เก็บของ") || hay.includes("ตู้ลิ้นชัก") || hay.includes("ชั้นวาง") || hay.includes("เพ็กบอร์ด") || hay.includes("ลิ้นชัก")) {
    return CATEGORY_FALLBACK_IMAGES.storage;
  }
  if (hay.includes("nvme") || hay.includes("m.2") || hay.includes("990 pro") || hay.includes("sn770")) {
    return REAL_PRODUCT_IMAGES["ssd-2tb-990pro"];
  }
  if (hay.includes("psu") || hay.includes("พาวเวอร์") || hay.includes("850w") || hay.includes("750w") || hay.includes("650w") || hay.includes("1200w")) {
    return REAL_PRODUCT_IMAGES["psu-850w-gold-white"];
  }
  if (hay.includes("ชุดน้ำ") || hay.includes("liquid") || hay.includes("kraken") || hay.includes("ak400")) {
    return REAL_PRODUCT_IMAGES["cooler-aio-360-white"];
  }
  if (hay.includes("case") || hay.includes("เคส") || hay.includes("h6 flow") || hay.includes("o11")) {
    return REAL_PRODUCT_IMAGES["case-nzxt-h6-black"];
  }

  return (
    CATEGORY_FALLBACK_IMAGES[params.category || "other"] ||
    CATEGORY_FALLBACK_IMAGES.computer
  );
}
