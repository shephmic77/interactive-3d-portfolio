# V3: stepped building

- Ground floor remains a single wide and compact rectangular block.
- Replaced the full-size upper storey with a smaller room shifted left and back.
- Exposed first-floor roof now forms a clear front/right terrace with a railing.
- Added a dedicated rooftop terrace above the smaller second storey.
- Kept two main box masses only, with plants, pipes, lighting, and limited rooftop utilities for a layered, whimsical silhouette.
- Repositioned second-floor doors/windows/awnings to match the new building geometry.
- Maintained the 5 signs and existing destination objects: books, corkboard, resume, vending machine, arcade.
- Fixed 3D initialization: the helper named `window()` shadowed the global browser `window`, causing `matchMedia` to fail. Renamed it to `facadeWindow()`. Added safe media-query guards in both code modules.
- Left all requested end-game personal decorations out of the site, and appended the newest ideas to their hold list.

This is procedural Three.js code, so the appearance will differ from the sketch and high-detail rendered concepts.
