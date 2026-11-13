# Graph Report - b2c-foodservice  (2026-11-03)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 4646 nodes · 16042 edges · 167 communities (156 shown, 11 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 189 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1f48c449`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- Community 54
- Community 55
- Community 56
- Community 57
- Community 58
- Community 59
- Community 60
- Community 61
- Community 62
- Community 63
- Community 64
- Community 65
- Community 66
- Community 67
- Community 68
- Community 69
- Community 70
- Community 71
- Community 72
- Community 73
- Community 74
- Community 75
- Community 76
- Community 77
- Community 78
- Community 79
- Community 80
- Community 81
- Community 82
- Community 83
- Community 84
- Community 85
- Community 86
- Community 87
- Community 88
- Community 89
- Community 90
- Community 91
- Community 92
- Community 93
- Community 94
- Community 95
- Community 96
- Community 97
- Community 98
- Community 99
- Community 100
- Community 101
- Community 102
- Community 103
- Community 104
- Community 105
- Community 106
- Community 107
- Community 108
- Community 109
- Community 110
- Community 111
- Community 112
- Community 113
- Community 114
- Community 115
- Community 116
- Community 117
- Community 118
- Community 119
- Community 120
- Community 121
- Community 122
- Community 123
- Community 124
- Community 125
- Community 126
- Community 127
- Community 128
- Community 129
- Community 130
- Community 131
- Community 132
- Community 133
- Community 134
- Community 135
- Community 136
- Community 137
- Community 138
- Community 139
- Community 140
- Community 141
- Community 142
- Community 143
- Community 144
- Community 145
- Community 146
- Community 147
- Community 148
- Community 149
- Community 150
- Community 151
- Community 152
- Community 153
- Community 154
- Community 155
- Community 156
- Community 157
- Community 158
- Community 160
- Community 161
- Community 164
- Community 165

## God Nodes (most connected - your core abstractions)
1. `next-intl` - 236 edges
2. `Icon()` - 166 edges
3. `react` - 144 edges
4. `Button()` - 116 edges
5. `Link()` - 106 edges
6. `cn()` - 99 edges
7. `@testing-library/react` - 91 edges
8. `next` - 85 edges
9. `getSession()` - 81 edges
10. `AppError` - 68 edges

## Surprising Connections (you probably didn't know these)
- `doAdd()` --indirect_call--> `qty()`  [INFERRED]
  design/export/b2b2c-retailer-design/project/app/pages-pdp.jsx → seed/src/fulfilment.test.ts
- `doAdd()` --indirect_call--> `product()`  [INFERRED]
  design/export/b2b2c-retailer-design/project/app/pages-pdp.jsx → storefront/components/home/home-fixtures.ts
- `int()` --calls--> `AppError`  [EXTRACTED]
  storefront/app/api/orders/route.ts → storefront/lib/errors.ts
- `OrdersPage` --references--> `OrderView`  [EXTRACTED]
  storefront/hooks/useOrders.ts → storefront/lib/types.ts
- `RankedStore` --references--> `Store`  [EXTRACTED]
  storefront/lib/store-search.ts → storefront/lib/types.ts

## Import Cycles
- None detected.

## Communities (167 total, 11 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.04
Nodes (91): jose, next, server-only, ct, ctx, jar, cookieOf(), ct (+83 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (86): ALL_KINDS, CONTRACT_KEYS, COUNTRIES, Country, CURRENCIES, Currency, hash(), K (+78 more)

### Community 2 - "Community 2"
Cohesion: 0.04
Nodes (42): @testing-library/user-event, AccountShell(), customer, shell(), customer, TWO, render(), base (+34 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (55): dynamic, GET, call(), dynamic, Fulfilment, BK, collect, h (+47 more)

### Community 4 - "Community 4"
Cohesion: 0.05
Nodes (58): ADVANCE_TARGETS, AdvanceArgs, AdvancePort, assertConfirm(), checkOwner(), main(), OrderOwnerPort, OwnerCheck (+50 more)

### Community 5 - "Community 5"
Cohesion: 0.06
Nodes (55): dynamic, POST, bag(), ctx(), del(), get(), jar, patch() (+47 more)

### Community 6 - "Community 6"
Cohesion: 0.06
Nodes (61): mixed(), h, ship, sub, mixed(), pod, Routes, clusterOf() (+53 more)

### Community 7 - "Community 7"
Cohesion: 0.05
Nodes (56): call(), ct, ctx, jar, POST, dynamic, GET, ct (+48 more)

### Community 8 - "Community 8"
Cohesion: 0.05
Nodes (60): dynamic, GET, dynamic, POST, call(), ct, delivered(), jar (+52 more)

### Community 9 - "Community 9"
Cohesion: 0.09
Nodes (48): CancelDialog(), ChangeIntervalDialog(), useDateLabel(), StatusPill(), TONE, SubscriptionCard(), AppliedCodes(), blockerKey() (+40 more)

### Community 10 - "Community 10"
Cohesion: 0.08
Nodes (57): DELETE, dynamic, NO_STORE, PATCH, ct, ctx, jar, dynamic (+49 more)

### Community 11 - "Community 11"
Cohesion: 0.07
Nodes (44): BagRoute(), dynamic, HomePage(), Props, CategoryTiles(), MAX_TILES, tileCategories(), CollectionBanner() (+36 more)

### Community 12 - "Community 12"
Cohesion: 0.07
Nodes (64): shippingMethodKeyFor(), addLine(), applyDiscountCode(), availableFor(), buildAddLineAction(), CART_EXPAND, CartMarket, CartViewResult (+56 more)

### Community 13 - "Community 13"
Cohesion: 0.08
Nodes (45): AccountOrderNotFound(), ListingError(), ProductError(), AddressCard(), AddressesTab(), AddressForm(), AddressFormProps, ORDER (+37 more)

### Community 14 - "Community 14"
Cohesion: 0.09
Nodes (40): ConfirmationRoute(), dynamic, ConfirmationIndexRoute(), dynamic, CollectionTab(), directionsUrl(), OrderCard(), OrderCardProps (+32 more)

### Community 15 - "Community 15"
Cohesion: 0.08
Nodes (37): next-intl, ACCOUNT_TABS, AccountTabId, AccountTabs(), isActive(), TabDef, visibleTabs(), InstoreBagButton() (+29 more)

### Community 16 - "Community 16"
Cohesion: 0.06
Nodes (47): Api, assertCleanupAllowed(), CleanupOptions, DELETE_ORDER, deleteTargets(), formatPlan(), isSeedOwned(), loadManifest() (+39 more)

### Community 17 - "Community 17"
Cohesion: 0.07
Nodes (52): dynamic, PUT, dynamic, POST, CartRoute(), dynamic, address(), loadCart() (+44 more)

### Community 18 - "Community 18"
Cohesion: 0.06
Nodes (28): @testing-library/react, m, render(), SECRET, ca, flatten(), us, flatten() (+20 more)

### Community 19 - "Community 19"
Cohesion: 0.08
Nodes (41): Harness(), StorePickerHarnessPage(), PasswordForm(), ProfileFields(), AuthCard(), AuthCardProps, AuthNotice(), AuthNoticeProps (+33 more)

### Community 20 - "Community 20"
Cohesion: 0.08
Nodes (38): ProductSection(), FacetGroup(), Mark(), Option(), roast, Accordion(), ColourSwatches(), ColourSwatchesProps (+30 more)

### Community 21 - "Community 21"
Cohesion: 0.07
Nodes (43): Call, Item, ImageMap, loadRecordedImages(), typeDrafts, PRODUCTS, REVIEW_COUNTS, Obj (+35 more)

### Community 22 - "Community 22"
Cohesion: 0.05
Nodes (41): call(), session, BROOKLYN, HOURS, seed(), SOHO, THRESHOLD, setup() (+33 more)

### Community 23 - "Community 23"
Cohesion: 0.08
Nodes (37): react, COLOUR_TOKENS, RADII, Row(), Section(), Sink(), STEPS, SWATCH_KEYS (+29 more)

### Community 24 - "Community 24"
Cohesion: 0.06
Nodes (48): andOf(), anyOf(), buildFacets(), BuildOptions, buildQuery(), buildSearchRequest(), buildSort(), collectionValueClause() (+40 more)

### Community 25 - "Community 25"
Cohesion: 0.09
Nodes (44): decode(), dynamic, generateMetadata(), InstoreCategoryRoute(), Props, quiet(), RelatedStrip(), addAllToBag() (+36 more)

### Community 26 - "Community 26"
Cohesion: 0.07
Nodes (33): apiRoot, client, env, projectKey, ProjectionContext, isRecord(), mapAttributes(), mapScalar() (+25 more)

### Community 27 - "Community 27"
Cohesion: 0.06
Nodes (44): canReturn(), deriveOrderStatus(), ReturnableInput, returnWindowEnds(), StatusInput, base, s(), TEMPLATES (+36 more)

### Community 28 - "Community 28"
Cohesion: 0.08
Nodes (36): dynamic, dynamic, POST, ct, ctx, jar, PROFILE, dynamic (+28 more)

### Community 29 - "Community 29"
Cohesion: 0.10
Nodes (35): LocaleLayout(), Footer(), Header(), MegaPanel(), MegaPanelProps, MobileNav(), CLOSE_DELAY_MS, PrimaryNav() (+27 more)

### Community 30 - "Community 30"
Cohesion: 0.07
Nodes (37): Endpoint, endpoint(), orUndefined(), sdkApi(), API_KIND, apiTestData(), Applied, applyDelete() (+29 more)

### Community 31 - "Community 31"
Cohesion: 0.12
Nodes (35): JournalPage(), Props, ArticlePage(), generateMetadata(), generateStaticParams(), Props, loadPage(), nav (+27 more)

### Community 32 - "Community 32"
Cohesion: 0.10
Nodes (37): dynamic, GET, NO_STORE, PUT, dynamic, GET, ct, ctx (+29 more)

### Community 33 - "Community 33"
Cohesion: 0.11
Nodes (38): FilterChip, FilterSheet(), SortOption, SortSelect(), Toolbar(), camel(), humanize(), ListingInput (+30 more)

### Community 34 - "Community 34"
Cohesion: 0.09
Nodes (36): CheckoutNotReady, ctx, h, put(), setSession(), stateOf(), collectionOffered(), CheckoutBlocker (+28 more)

### Community 35 - "Community 35"
Cohesion: 0.09
Nodes (37): submit(), CODE_REJECTION_REASONS, CodeRejectionReason, isCodeRejectionReason(), rejectionKey(), stateReasonKey(), STATES, toCodeState() (+29 more)

### Community 36 - "Community 36"
Cohesion: 0.09
Nodes (34): assignImages(), attrs(), categoryImageItems(), categoryImagesFor(), HERE, ImageRef, productDrafts(), productImageItems() (+26 more)

### Community 37 - "Community 37"
Cohesion: 0.11
Nodes (30): AccountHeader(), Probe(), Mode, ReviewsSection(), ReviewsSectionProps, fetchJson(), useAccount(), useAccountSummary() (+22 more)

### Community 38 - "Community 38"
Cohesion: 0.10
Nodes (31): ContentPage(), ContentPageProps, TocEntry, DraftBanner(), EffectiveDate(), FallbackNotice(), FIGURES, PolicyView() (+23 more)

### Community 39 - "Community 39"
Cohesion: 0.12
Nodes (22): cart(), Count(), posted, render(), VariantStock, accessoryPage(), ALL_DAY, BASE (+14 more)

### Community 40 - "Community 40"
Cohesion: 0.12
Nodes (33): Card, PdpContext, PdpProvider(), PdpState, Props, AddInput, AddKey, AddState (+25 more)

### Community 41 - "Community 41"
Cohesion: 0.09
Nodes (37): CATEGORIES, ancestorsOf(), apiValue(), asArray(), ATTR_TYPES, candidates(), CATEGORY_KEYS, categoryId() (+29 more)

### Community 42 - "Community 42"
Cohesion: 0.12
Nodes (26): generateMetadata(), generateMetadata(), generateMetadata(), generateMetadata(), isPolicySlug(), PolicyPage(), Props, DISALLOWED (+18 more)

### Community 43 - "Community 43"
Cohesion: 0.10
Nodes (34): account, addCustomer(), badCustom(), baseCart(), cartBody(), CARTS, centMoney(), ctError() (+26 more)

### Community 44 - "Community 44"
Cohesion: 0.10
Nodes (23): RatingSummary(), getValidCountryConfig(), m, toMarketOptions(), validateMarket(), fetchMarkets(), getMarkets, CookieToSet (+15 more)

### Community 45 - "Community 45"
Cohesion: 0.09
Nodes (29): dynamic, POST, send(), VALID, onSubmit(), ContactFormProps, EMPTY, Status (+21 more)

### Community 46 - "Community 46"
Cohesion: 0.11
Nodes (26): AccountShellLayout(), dynamic, StorePill(), AvailabilityChip(), Probe(), clock(), CollectBlock(), DAY_INDEX (+18 more)

### Community 47 - "Community 47"
Cohesion: 0.11
Nodes (25): AccountCollectionPage(), dynamic, generateMetadata, loadCollectionFigures(), getAttributeLabels, getCartEnrichment(), getInventoryDetail(), DetailReadContext (+17 more)

### Community 48 - "Community 48"
Cohesion: 0.10
Nodes (31): ls(), slugify(), FULFILMENT_VALUES, num(), ORDER_TYPE_VALUES, str(), text(), ACCESSORIES (+23 more)

### Community 49 - "Community 49"
Cohesion: 0.13
Nodes (26): BestsellersSection(), NewArrivalsSection(), SectionProps, STEPS, SubscribeStrip(), getProductSummaryByKey(), cardContext(), countSubscribable() (+18 more)

### Community 50 - "Community 50"
Cohesion: 0.17
Nodes (24): Body(), addErrorKey(), AddToBag(), BuyBox(), BuyBoxHeader(), FactsRow(), IntensityBar(), NoteChips() (+16 more)

### Community 51 - "Community 51"
Cohesion: 0.10
Nodes (21): dynamic, GET(), execute, checkEnvironment(), register(), FakeEnvError, getEnv, CheckoutSessionResult (+13 more)

### Community 52 - "Community 52"
Cohesion: 0.09
Nodes (26): NOTE_RETRY_MS, SubscriptionNote(), useSubscriptionActions(), useSubscriptions(), keyRecurringOrders(), toSavedItem(), toSavedList(), ApiErrorBody (+18 more)

### Community 54 - "Community 54"
Cohesion: 0.09
Nodes (29): eslint-config-next, jsdom, tailwindcss, @tailwindcss/postcss, @testing-library/dom, @types/react, @types/react-dom, vite-tsconfig-paths (+21 more)

### Community 55 - "Community 55"
Cohesion: 0.13
Nodes (19): swr, ApiError, jsonFetcher(), AddToCartInput, useAvailability(), JSON_HEADERS, useCheckout(), ORDER_POLL_MS (+11 more)

### Community 56 - "Community 56"
Cohesion: 0.09
Nodes (25): checklistBlock(), checklistSection(), coverageOf(), listWsFile(), norm(), quoted(), scenariosOf(), testsIn() (+17 more)

### Community 57 - "Community 57"
Cohesion: 0.12
Nodes (27): CAT_INSTORE_DRINKS, DRINKS, INSTORE_CATEGORY_TYPE_KEY, INSTORE_VISIBILITY_FIELD, INSTORE_VISIBILITY_VALUES, instoreCategoryDraft, instoreCategoryTypeDraft, InstoreVisibility (+19 more)

### Community 58 - "Community 58"
Cohesion: 0.14
Nodes (19): AboutPage(), Props, ContactPage(), generateMetadata(), Props, ContactView(), AboutView(), FooterStoreButton() (+11 more)

### Community 59 - "Community 59"
Cohesion: 0.12
Nodes (21): ReviewList(), ReviewListProps, base, PanelHarness(), ReviewListPanel(), SortSelect(), ReviewApiError, send() (+13 more)

### Community 60 - "Community 60"
Cohesion: 0.20
Nodes (9): Kind, ProjectView, Res, memoryRecurring(), world(), ApiError, clone(), FakeApi (+1 more)

### Community 61 - "Community 61"
Cohesion: 0.13
Nodes (20): JSON_HEADERS, SwitchTarget, post(), ReturnLineDraft, useOrderActions(), KEY_ACCOUNT, KEY_CART, KEY_CART_COUNT (+12 more)

### Community 62 - "Community 62"
Cohesion: 0.09
Nodes (27): dotenv, tsx, dependencies, @commercetools/platform-sdk@^8.0.0, @commercetools/ts-client@^4.0.0, dotenv@^16.4.5, description, devDependencies (+19 more)

### Community 63 - "Community 63"
Cohesion: 0.11
Nodes (24): nudgeTarget(), fetchAttributeLabels(), EnrichContext, flatten(), isEnum(), keyOf(), mapProduct(), readProducts() (+16 more)

### Community 64 - "Community 64"
Cohesion: 0.17
Nodes (16): dynamic, POST, DELETE, dynamic, ct, ctx, jar, dynamic (+8 more)

### Community 65 - "Community 65"
Cohesion: 0.15
Nodes (16): GlobalError(), LocaleError(), Forbidden(), NotFound(), Unauthorized(), RootNotFound(), ROOT, ErrorKind (+8 more)

### Community 66 - "Community 66"
Cohesion: 0.10
Nodes (9): routes(), TABLE, flatten(), evidence, out, files(), keys(), Tree (+1 more)

### Community 67 - "Community 67"
Cohesion: 0.13
Nodes (17): dynamic, GET(), archivo, generateMetadata(), generateViewport(), roboto, robotoMono, CheckoutRoute() (+9 more)

### Community 68 - "Community 68"
Cohesion: 0.13
Nodes (22): ct, input, market, MINE, CUSTOM, ensureOrderType(), IN_STORE_PURCHASE, Lookup (+14 more)

### Community 69 - "Community 69"
Cohesion: 0.11
Nodes (19): Action, allVariants(), KeyOf, LStr, lstringDiffers(), normAttr(), planCategoryUpdate(), planChannelUpdate() (+11 more)

### Community 70 - "Community 70"
Cohesion: 0.13
Nodes (20): motion, theme, tokens, tokensCss, componentFiles(), RAW_VALUES, rawValueHits(), SPEC (+12 more)

### Community 71 - "Community 71"
Cohesion: 0.12
Nodes (18): order(), item(), customer, policies, Setup, setup(), customer, order() (+10 more)

### Community 72 - "Community 72"
Cohesion: 0.16
Nodes (21): mapPrice(), buildSelectors(), DetailContext, FACT_ONLY, isEnum(), keyOf(), mapProductDetail(), mapRecurring() (+13 more)

### Community 73 - "Community 73"
Cohesion: 0.09
Nodes (19): B2B_ACCOUNT, B2B_ADDRESSES, B2B_FLOWS, B2B_LISTS, B2B_MEMBERS, B2B_ORDERS, B2B_QUOTES, CATEGORIES (+11 more)

### Community 74 - "Community 74"
Cohesion: 0.17
Nodes (17): CheckoutIssues(), Banner, BannerMessage(), CheckoutPage(), Pay(), Review(), SubscriptionNeedsAccount(), DeliveryNote() (+9 more)

### Community 75 - "Community 75"
Cohesion: 0.15
Nodes (17): haversineKm(), LatLng, rad(), BROOKLYN, SOHO, byCityThenName(), compact(), matchesQuery() (+9 more)

### Community 76 - "Community 76"
Cohesion: 0.21
Nodes (20): addReply(), AddressCard(), ApprovalBadge(), B2BAddresses(), B2BApprovals(), B2BDashboard(), B2BFlows(), B2BLists() (+12 more)

### Community 77 - "Community 77"
Cohesion: 0.14
Nodes (20): ACCESSORY_KINDS, BADGES, base(), boolAttr(), BREW_METHODS, BUNDLES, COLOURS, common (+12 more)

### Community 78 - "Community 78"
Cohesion: 0.13
Nodes (14): Opener(), setup(), fallback(), LocaleFlag(), setup(), STORE, TREE, CA (+6 more)

### Community 79 - "Community 79"
Cohesion: 0.12
Nodes (8): ALL_PASS, report(), script, vitestFile(), checkSecrets(), REQUIRED_NAMES, GOOD_EXAMPLE, walk()

### Community 80 - "Community 80"
Cohesion: 0.17
Nodes (14): dynamic, generateMetadata(), ProductPage(), productPath(), Props, safeDecode(), h, InstoreProduct() (+6 more)

### Community 81 - "Community 81"
Cohesion: 0.14
Nodes (17): Pending, Verify, AddressWrite, AddressRequest, readAddressRequest(), ADDRESS_COUNTRIES, AddressFieldError, AddressValidation (+9 more)

### Community 82 - "Community 82"
Cohesion: 0.14
Nodes (16): DemoSignInProps, PasswordStrengthProps, AuthApiError, AuthResult, isUserScopedKey(), post(), matchesEmail(), PASSWORD_MAX (+8 more)

### Community 83 - "Community 83"
Cohesion: 0.23
Nodes (14): afterDeleteDefault(), DEFAULT_ADDRESS_AFTER_DELETE, addAddress(), changeAddress(), listAddresses(), owned(), readCustomer(), removeAddress() (+6 more)

### Community 84 - "Community 84"
Cohesion: 0.13
Nodes (16): getProjectLanguages, isLanguageSupported(), matchedSkusOf(), RawResponse, RawResult, run(), SearchOutcome, searchProducts() (+8 more)

### Community 85 - "Community 85"
Cohesion: 0.17
Nodes (9): KitchenSink(), DesignKitchenSinkPage(), notFound, FaqAccordion(), openFromHash(), FaqFeedback(), FEEDBACK_TIMEOUT_MS, CATALOGUES (+1 more)

### Community 86 - "Community 86"
Cohesion: 0.18
Nodes (15): FaqPage(), generateMetadata(), Props, Blocks(), Cta(), channelFor(), renderTokens(), FALLBACKS (+7 more)

### Community 87 - "Community 87"
Cohesion: 0.16
Nodes (13): DetailAccordions(), useSpecValue(), ReviewsSlot(), getScanProduct(), h, mapScanProduct(), CART_CARRY_OVER_ENABLED, LOW_STOCK_THRESHOLD (+5 more)

### Community 88 - "Community 88"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 89 - "Community 89"
Cohesion: 0.14
Nodes (12): ct, ctx, GOOD, jar, DELETE, dynamic, NO_STORE, PATCH (+4 more)

### Community 90 - "Community 90"
Cohesion: 0.12
Nodes (7): classifyCameraError(), NATIVE_FORMATS, Boom, D, fakeStream(), None, track()

### Community 91 - "Community 91"
Cohesion: 0.12
Nodes (17): postcss, react-dom, @zxing/browser, @zxing/library, dependencies, @commercetools/checkout-browser-sdk@^1.7.5, @ct-demos/demotools@^6.4.0, jose@^6.2.13 (+9 more)

### Community 92 - "Community 92"
Cohesion: 0.18
Nodes (14): findTwin(), planFulfilmentSwitch(), PlanLine, PlanOp, planStoreChange(), SHIP_METHOD_KEY, SwitchPlan, SwitchTarget (+6 more)

### Community 93 - "Community 93"
Cohesion: 0.24
Nodes (14): B2BAccountBar(), BarSelect(), CartDrawer(), Header(), Icon(), ICONS, MobileNav(), PickupBadge() (+6 more)

### Community 94 - "Community 94"
Cohesion: 0.12
Nodes (16): scripts, check, lint, reset, seed, seed:advance-order, seed:cleanup, seed:cleanup-tests (+8 more)

### Community 95 - "Community 95"
Cohesion: 0.19
Nodes (11): dynamic, RegisterPage(), Search, h, Props, render(), readGuestEmail(), destinationFrom() (+3 more)

### Community 96 - "Community 96"
Cohesion: 0.28
Nodes (12): CategoryPage(), generateMetadata(), Props, generateMetadata(), Props, SearchPage(), generateMetadata(), Props (+4 more)

### Community 97 - "Community 97"
Cohesion: 0.23
Nodes (11): normaliseScan(), ScanParse, SKU_PATTERN, INITIAL_SCAN_STATE, REPEAT_WINDOW_MS, ResultState, ScanEvent, scanReducer() (+3 more)

### Community 98 - "Community 98"
Cohesion: 0.20
Nodes (11): @commercetools/checkout-browser-sdk, failureOf(), HostedCheckout(), HostedFailure, HostedSession, HostedStart, sdkLocale(), startHostedCheckout() (+3 more)

### Community 99 - "Community 99"
Cohesion: 0.21
Nodes (8): TweakColor(), TweakRadio(), TweakRow(), TweakSelect(), TweakSlider(), TweakText(), __TwkCheck(), __twkIsLight()

### Community 100 - "Community 100"
Cohesion: 0.20
Nodes (10): AccountIndexPage(), dynamic, AccountPaymentMethodsPage(), dynamic, generateMetadata, AccountSettingsPage(), dynamic, generateMetadata (+2 more)

### Community 101 - "Community 101"
Cohesion: 0.24
Nodes (13): notFound(), orderFromCart(), orderRoutes(), ORDERS, placedOrders(), STATE_CHAIN, addInterval(), apply() (+5 more)

### Community 102 - "Community 102"
Cohesion: 0.26
Nodes (13): apply(), clientModule(), copy(), err(), FakeCode, FakeUpdate, Line, money() (+5 more)

### Community 103 - "Community 103"
Cohesion: 0.19
Nodes (10): AccountReviewsPage(), dynamic, generateMetadata, AccountSavedPage(), dynamic, generateMetadata, accountMetadata(), accountOrderMetadata() (+2 more)

### Community 104 - "Community 104"
Cohesion: 0.25
Nodes (11): FILTERS, OrderFilters(), OrderList(), FILTERS, OrdersTab(), parseOrdersQuery(), ORDERS_PAGE_SIZE, OrdersPage (+3 more)

### Community 105 - "Community 105"
Cohesion: 0.31
Nodes (10): DroppedLinesNotice(), parse(), snapshot(), subscribe(), MarketSwitchResult, DROPPED_LINES_EVENT, DROPPED_LINES_KEY, storeDroppedLines() (+2 more)

### Community 106 - "Community 106"
Cohesion: 0.25
Nodes (10): ManualEntry(), ScanCamera(), Message(), Props, ScanDialog(), ScanSession(), Window, CameraState (+2 more)

### Community 107 - "Community 107"
Cohesion: 0.24
Nodes (12): CheckoutErrorCode, CURRENCY_OF, currencyMatchesCountry(), NAME_PATTERN, normaliseCode(), PickupInput, PickupPerson, SHOP_COUNTRIES (+4 more)

### Community 108 - "Community 108"
Cohesion: 0.16
Nodes (11): api, CA, client, firstSku(), multipleCart(), post(), projectKey, results (+3 more)

### Community 109 - "Community 109"
Cohesion: 0.15
Nodes (12): compilerOptions, esModuleInterop, module, moduleResolution, noEmit, noUncheckedIndexedAccess, resolveJsonModule, skipLibCheck (+4 more)

### Community 110 - "Community 110"
Cohesion: 0.18
Nodes (9): h, PAGES, params, AccountAddressesPage(), dynamic, generateMetadata, AccountOrdersPage(), dynamic (+1 more)

### Community 111 - "Community 111"
Cohesion: 0.27
Nodes (9): AccountMenu(), CartButton(), HeaderActions(), LocalePill(), SearchToggle(), LocaleChooser(), REGION_KEYS, useCartCount() (+1 more)

### Community 112 - "Community 112"
Cohesion: 0.27
Nodes (10): ShipBlock(), useNow(), addBusinessDays(), DeliveryEstimate, deliveryEstimate(), DeliveryRule, isBusinessDay(), Local (+2 more)

### Community 113 - "Community 113"
Cohesion: 0.18
Nodes (9): ASTORIA, AVAILABILITY, BROOKLYN, fallback(), OPEN_ALL, Opener(), setup(), SOHO (+1 more)

### Community 114 - "Community 114"
Cohesion: 0.26
Nodes (12): fetchDeliveryDays(), linesOf(), mapLine(), mapRecurringOrder(), mapSchedule(), pendingFrom(), scheduleKey(), STATE_OF (+4 more)

### Community 115 - "Community 115"
Cohesion: 0.15
Nodes (6): CameraError, CameraFailure, DetectorConstructor, DetectorLike, nativeDetector(), ScannerSession

### Community 116 - "Community 116"
Cohesion: 0.17
Nodes (9): buckets, files, notes, plans, qFiles, qPath, t, tFiles (+1 more)

### Community 117 - "Community 117"
Cohesion: 0.23
Nodes (11): Probe(), cache, EMPTY, listeners, ListResponse, merging, read(), send() (+3 more)

### Community 118 - "Community 118"
Cohesion: 0.23
Nodes (9): ADMIN_SCOPES, checkDebugRoutes(), checkPredeploy(), checkPredeployEnv(), checkPredeployFiles(), PUBLIC_NAME_OK, REQUIRED_ENV, REQUIRED_SCOPES (+1 more)

### Community 119 - "Community 119"
Cohesion: 0.36
Nodes (10): B2B_PACKS, B2BList(), B2BProductRow(), B2BVariantRow(), colorAbbr(), LookupModal(), packPrice(), prodAbbr() (+2 more)

### Community 120 - "Community 120"
Cohesion: 0.29
Nodes (7): @ct-demos/demotools, GET, POST, dynamic, GatePage(), GATE_HOME_PATH, isDemoGateOpen()

### Community 121 - "Community 121"
Cohesion: 0.20
Nodes (9): eslint, CLIENT_BUILDER, eslintConfig, NAV_RESTRICTIONS, RAW_HEX, SDK_PATTERN, TESTS, rule (+1 more)

### Community 122 - "Community 122"
Cohesion: 0.18
Nodes (7): DELETE, GET, OPTIONS, PATCH, POST, PUT, routeDirs()

### Community 123 - "Community 123"
Cohesion: 0.22
Nodes (8): dynamic, NOTICES, Params, Search, SignInPage(), h, render(), SignInNotice

### Community 124 - "Community 124"
Cohesion: 0.29
Nodes (7): contentSecurityPolicy(), CT_ORIGINS, HeaderPair, permissionsPolicy(), securityHeaders(), baseConfig, withNextIntl

### Community 125 - "Community 125"
Cohesion: 0.18
Nodes (11): scripts, build, check, dev, lint, predeploy, start, test (+3 more)

### Community 126 - "Community 126"
Cohesion: 0.29
Nodes (10): FIXTURES, BY_RATING, json(), matching(), NAMES, notFound(), orders(), recompute() (+2 more)

### Community 127 - "Community 127"
Cohesion: 0.24
Nodes (6): CATEGORIES, ct, ID(), projection(), reply(), STORE

### Community 128 - "Community 128"
Cohesion: 0.33
Nodes (6): Routes, setup(), fakeEngine(), notFoundBody, scanProduct(), usd()

### Community 129 - "Community 129"
Cohesion: 0.36
Nodes (7): assertValidSku(), getAvailabilityForSkus(), getStoreAvailability(), getStoreStock(), mapEntries(), { execute, get }, STORES

### Community 130 - "Community 130"
Cohesion: 0.25
Nodes (4): ACTIVITIES, ALL_COLORS, buildFacets(), productActivities()

### Community 131 - "Community 131"
Cohesion: 0.22
Nodes (3): jar, orders, parts

### Community 132 - "Community 132"
Cohesion: 0.22
Nodes (8): DELETE, GET, handler, HEAD, OPTIONS, PATCH, POST, PUT

### Community 133 - "Community 133"
Cohesion: 0.42
Nodes (6): checkVersions(), greaterThan(), installed(), parse(), readJson(), GOOD

### Community 134 - "Community 134"
Cohesion: 0.39
Nodes (6): card(), customer, ids(), item(), pid(), routes()

### Community 135 - "Community 135"
Cohesion: 0.32
Nodes (6): card(), h, line(), market, pid(), session

### Community 136 - "Community 136"
Cohesion: 0.32
Nodes (5): FORM_TYPES, GuardFailure, guardRequest(), MUTATING, ownHosts()

### Community 137 - "Community 137"
Cohesion: 0.29
Nodes (4): LOCALES, MEGA_ACTIVITY, MEGA_BY_KEY, REGION_ORDER

### Community 138 - "Community 138"
Cohesion: 0.43
Nodes (4): JsonLd(), LINE_SEPARATOR, PARAGRAPH_SEPARATOR, safeJsonLd()

### Community 139 - "Community 139"
Cohesion: 0.43
Nodes (5): InstoreProviders(), ScanDialog, ScannerApi, ScannerContext, ScannerProvider()

### Community 140 - "Community 140"
Cohesion: 0.33
Nodes (5): DIRS, files, ROOT, UI_DIRS, walk()

### Community 141 - "Community 141"
Cohesion: 0.53
Nodes (5): Accordion(), AddToListMenu(), ProductDetail(), doAdd(), SizeGuide()

### Community 142 - "Community 142"
Cohesion: 0.33
Nodes (5): context, rules, proposal, tasks, schema

### Community 143 - "Community 143"
Cohesion: 0.53
Nodes (3): checkBundleSecrets(), SECRET_NAMES, walk()

### Community 144 - "Community 144"
Cohesion: 0.53
Nodes (5): createAccountMock(), filterOrders(), route(), updateCustomer(), updateOrder()

### Community 145 - "Community 145"
Cohesion: 0.60
Nodes (4): App(), loadLS(), saveLS(), TWEAK_DEFAULTS

### Community 146 - "Community 146"
Cohesion: 0.50
Nodes (3): Garment(), GARMENTS, paletteFor()

### Community 147 - "Community 147"
Cohesion: 0.50
Nodes (3): AccountPage(), DEMO_ORDERS, Toggle()

### Community 148 - "Community 148"
Cohesion: 0.40
Nodes (4): dynamic, GET, NO_STORE, POST

### Community 149 - "Community 149"
Cohesion: 0.50
Nodes (4): AccountOrderPage(), dynamic, generateMetadata, loadAccountOrder()

### Community 150 - "Community 150"
Cohesion: 0.50
Nodes (4): AccountProfilePage(), dynamic, generateMetadata, ProfileForm()

### Community 151 - "Community 151"
Cohesion: 0.40
Nodes (3): DIRS, flatten(), ROOT

### Community 152 - "Community 152"
Cohesion: 0.60
Nodes (3): Stepper(), StepperProps, Harness()

### Community 154 - "Community 154"
Cohesion: 0.50
Nodes (3): customer, toAppAddress(), toAuthCart()

### Community 155 - "Community 155"
Cohesion: 0.40
Nodes (3): flatten(), LOCALES, ROOT

### Community 157 - "Community 157"
Cohesion: 0.50
Nodes (3): AccountSubscriptionsPage(), dynamic, generateMetadata

### Community 158 - "Community 158"
Cohesion: 0.67
Nodes (3): DIR, flatten(), keysOf()

## Knowledge Gaps
- **1 isolated node(s):** `{ redirect, permanentRedirect, usePathname, useRouter, getPathname }`
  These have ≤1 connection - possible missing edges. (Counts symbols only; 1337 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next-intl` connect `Community 15` to `Community 2`, `Community 9`, `Community 11`, `Community 12`, `Community 13`, `Community 14`, `Community 17`, `Community 18`, `Community 19`, `Community 20`, `Community 149`, `Community 150`, `Community 23`, `Community 152`, `Community 25`, `Community 155`, `Community 29`, `Community 157`, `Community 31`, `Community 33`, `Community 37`, `Community 38`, `Community 39`, `Community 40`, `Community 42`, `Community 44`, `Community 45`, `Community 46`, `Community 47`, `Community 49`, `Community 50`, `Community 52`, `Community 54`, `Community 55`, `Community 58`, `Community 59`, `Community 61`, `Community 65`, `Community 67`, `Community 74`, `Community 80`, `Community 85`, `Community 86`, `Community 87`, `Community 91`, `Community 95`, `Community 96`, `Community 98`, `Community 100`, `Community 103`, `Community 104`, `Community 105`, `Community 106`, `Community 110`, `Community 111`, `Community 112`, `Community 123`, `Community 124`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **What connects `{ redirect, permanentRedirect, usePathname, useRouter, getPathname }` to the rest of the system?**
  _1 weakly-connected nodes found - possible missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.0365237815619495 - nodes in this community are weakly interconnected._
- **Why does `next` connect `Community 0` to `Community 3`, `Community 5`, `Community 7`, `Community 9`, `Community 11`, `Community 13`, `Community 14`, `Community 17`, `Community 19`, `Community 20`, `Community 149`, `Community 25`, `Community 28`, `Community 29`, `Community 31`, `Community 33`, `Community 42`, `Community 44`, `Community 47`, `Community 50`, `Community 51`, `Community 54`, `Community 58`, `Community 65`, `Community 67`, `Community 80`, `Community 85`, `Community 86`, `Community 91`, `Community 95`, `Community 96`, `Community 103`, `Community 104`, `Community 120`, `Community 123`, `Community 124`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.04662668665667166 - nodes in this community are weakly interconnected._
- **Why does `react` connect `Community 23` to `Community 2`, `Community 6`, `Community 9`, `Community 11`, `Community 139`, `Community 13`, `Community 14`, `Community 15`, `Community 18`, `Community 19`, `Community 20`, `Community 152`, `Community 29`, `Community 33`, `Community 37`, `Community 38`, `Community 39`, `Community 40`, `Community 42`, `Community 45`, `Community 46`, `Community 47`, `Community 50`, `Community 52`, `Community 54`, `Community 55`, `Community 59`, `Community 61`, `Community 65`, `Community 74`, `Community 78`, `Community 80`, `Community 82`, `Community 85`, `Community 91`, `Community 98`, `Community 105`, `Community 106`, `Community 110`, `Community 111`, `Community 112`, `Community 117`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.04490777866880513 - nodes in this community are weakly interconnected._