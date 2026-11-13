## ADDED Requirements

### Requirement: Brand token layer
The token file SHALL define the drinks palette, taken from `styles.css` (colours only: bg, surface, text, accent, accent-2 and the neutral, accent and accent-2 ramps 100 to 900), as overrides on the semantic tokens under a brand attribute selector. Fonts, radii and frame styles SHALL NOT change per brand, and components SHALL not contain brand-specific colour values. Where the drinks accent fails 4.5:1 as text, the 700 step SHALL be used for text and button fills.

#### Scenario: Token coverage
- **WHEN** the token test runs
- **THEN** both brands define every semantic colour token, drinks values equal the `styles.css` hex values, and text and button pairs meet 4.5:1
