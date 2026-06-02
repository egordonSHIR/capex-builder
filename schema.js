// Auto-generated schema. Re-run build_schema.py to regenerate.
window.SCHEMA = {
  phase1: [
  {"section": "Identity", "fields": [
    {"key": "prop_name", "label": "Property Name", "type": "text", "required": true},
    {"key": "mailing_address", "label": "Mailing Address", "type": "text"},
    {"key": "city", "label": "City", "type": "text"},
    {"key": "state", "label": "State", "type": "select", "options": ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"]},
    {"key": "zip", "label": "ZIP", "type": "text", "pattern": "[0-9]{5}"},
    {"key": "property_type", "label": "Property Type", "type": "select", "options": ["MFVA","EXSTAY"]},
    {"key": "year_built", "label": "Year Built", "type": "number", "min": 1900, "max": 2026}
  ]},
  {"section": "Units & Area", "fields": [
    {"key": "mf_units", "label": "Number of MF Units", "type": "number", "min": 0},
    {"key": "current_occupancy", "label": "Current Occupancy", "type": "number", "min": 0, "max": 1, "step": 0.01, "hint": "Decimal (0.75 = 75%)"},
    {"key": "mf_rsf", "label": "Multifamily RSF", "type": "number", "min": 0},
    {"key": "commercial_rsf", "label": "Commercial RSF", "type": "number", "min": 0},
    {"key": "common_sf", "label": "Common (non-rentable) Sqft", "type": "number", "min": 0, "decimals": 0},
    {"key": "overall_rsf", "label": "Overall RSF", "type": "number", "computed": "mf_rsf + commercial_rsf + common_sf", "decimals": 0},
    {"key": "land_sf", "label": "Land Sqft", "type": "number", "min": 0, "decimals": 0, "partner": {"target": "land_acres", "expr": "land_sf / 43560"}},
    {"key": "land_acres", "label": "Land Acreage", "type": "number", "min": 0, "decimals": 2, "partner": {"target": "land_sf", "expr": "land_acres * 43560"}}
  ]},
  {"section": "Building & Site", "fields": [
    {"key": "num_buildings", "label": "# Buildings", "type": "number", "min": 0},
    {"key": "vertical_floors", "label": "# Vertical Floors (Per Building)", "type": "number", "min": 0},
    {"key": "roofs_connected", "label": "Roofs Connected?", "type": "select", "options": ["Yes","No"], "show_if": "num_buildings > 1"},
    {"key": "elevators_yn", "label": "Elevators?", "type": "select", "options": ["Yes","No"]},
    {"key": "elevator_year_install", "label": "Year Installed", "type": "number", "min": 1900, "max": 2100, "show_if": "elevators_yn === 'Yes'"},
    {"key": "elevator_passenger", "label": "Passenger #", "type": "number", "min": 0, "show_if": "elevators_yn === 'Yes'"},
    {"key": "elevator_freight", "label": "Freight #", "type": "number", "min": 0, "show_if": "elevators_yn === 'Yes'"},
    {"key": "parking_spots_existing", "label": "# Parking Spots", "type": "number", "min": 0},
    {"key": "private_yard_existing", "label": "# Private Yards", "type": "number", "min": 0}
  ]}
],
  phase2: [
  {"section": "Basics", "fields": [
    {"key": "construction_type", "label": "Construction Type", "type": "select", "options": ["Wood Frame","Concrete","Steel"]},
    {"key": "flooring", "label": "Flooring", "type": "select", "options": ["Vinyl Plank","Hardwood","Carpeted","Hard 1st + Carpet 2nd"]},
    {"key": "roof_shape", "label": "Roof Shape", "type": "select", "options": ["Pitched","Flat"]},
    {"key": "roof_material", "label": "Roof Material", "type": "select", "options": ["TPO","Shingles","Torchdown","Bitumen","Built-Up","EPDM","PVC","Metal","Tile"]},
    {"key": "corridor", "label": "Corridor", "type": "select", "options": ["Interior (Hallway)","Exterior (Walkway)"]},
    {"key": "garage", "label": "Garage", "type": "select", "options": ["None","Attached","Detached Single","Detached Group"]},
    {"key": "parking_spots_to_add", "label": "Parking Spots to Add", "type": "number", "min": 0},
    {"key": "parking_type", "label": "Type", "type": "select", "options": ["Restripe","New Cover"], "show_if": "parking_spots_to_add > 0"},
    {"key": "parking_suggestion", "type": "info", "expr": "`Suggestion: ${(parking_spots_to_add||0) <= 0.05 * (p1_parking_spots_existing||0) ? 'Restripe' : 'New Cover'} (adding ${parking_spots_to_add||0} ≈ ${(p1_parking_spots_existing||0) ? Math.round(100*(parking_spots_to_add||0)/p1_parking_spots_existing) : 0}% of existing ${p1_parking_spots_existing||0})`", "show_if": "parking_spots_to_add > 0"},
    {"key": "parking_cost_info", "type": "info", "expr": "`Estimated cost: $${(parking_type === 'Restripe' ? Math.round((p1_parking_spots_existing||0)/100*5000) : (parking_type === 'New Cover' ? (parking_spots_to_add||0)*300*4 : 0)).toLocaleString()}` + (parking_type === 'Restripe' ? '  (Restripe: $5,000 per 100 existing spots)' : (parking_type === 'New Cover' ? '  (New Cover: $4/Sqft × 300 Sqft/spot)' : ''))", "show_if": "parking_spots_to_add > 0"}
  ]},
  {"section": "Exteriors", "fields": [
    {"key": "landscape_level", "label": "Landscape Level", "type": "select", "options": ["None","Low","Medium","High"]},
    {"key": "new_railing_lf", "label": "New Railing", "type": "number", "min": 0, "hint": "Linear Ft"},
    {"key": "new_railing_panels_sqft", "label": "New Railing Panels", "type": "number", "computed": "new_railing_lf * 3", "decimals": 0, "hint": "Auto: Linear Ft × 36\" (Sqft)"},
    {"key": "private_yards_add", "label": "Private Yards to Add", "type": "number", "min": 0, "hint": "# Yards"},
    {"key": "yard_perimeter_lf", "label": "Yard Perimeter", "type": "number", "min": 0, "hint": "Linear Ft"},
    {"key": "balconies", "label": "Balconies", "type": "select", "options": ["Yes","No"]},
    {"key": "patios", "label": "Patios", "type": "select", "options": ["Yes","No"]},
    {"key": "patio_type", "label": "Patio Type", "type": "select", "options": ["Front - Sliding Door","Back - Sliding Door","Front - Swinging Door","Back - Swinging Door"], "show_if": "patios === 'Yes'"}
  ]},
  {"section": "Common Interiors", "fields": [
    {"key": "hallway_length", "label": "Interior Hallway Dimensions — Length", "type": "number", "min": 0, "hint": "Feet"},
    {"key": "hallway_width", "label": "Interior Hallway Dimensions — Width", "type": "number", "min": 0, "hint": "Feet"},
    {"key": "hallway_info", "type": "info", "expr": "`Area per hallway: ${Math.round((hallway_length||0)*(hallway_width||0)).toLocaleString()} Sqft · Total hallways: ${(p1_num_buildings||0)*(p1_vertical_floors||0)} (${p1_num_buildings||0} bldgs × ${p1_vertical_floors||0} floors)`"},
    {"key": "fencing_existing_lf", "label": "Existing Fencing", "type": "number", "min": 0, "hint": "Linear Ft"},
    {"key": "fencing_needed_lf", "label": "Needed Fencing", "type": "number", "min": 0, "hint": "Linear Ft"}
  ]},
  {"section": "Mechanical (HVAC)", "fields": [
    {"key": "cooling", "label": "Cooling", "type": "select", "options": ["Ind. Condenser","Chiller FCUs","PTAC","VTAC"]},
    {"key": "heating", "label": "Heating", "type": "select", "options": ["Ind. Furnace","Boiler Radiator","Boiler FCUs","PTAC","VTAC"]}
  ]},
  {"section": "Plumbing", "fields": [
    {"key": "hot_water_type", "label": "Hot Water Type", "type": "select", "options": ["HWH-Gas","HWH-Elec","Boiler"]},
    {"key": "hot_water_count", "label": "# Hot Water", "type": "number", "min": 0, "dynamic_label": "`# ${hot_water_type || '[Hot Water Type]'}`"},
    {"key": "plumbing_pipes", "label": "Plumbing Pipes", "type": "select", "options": ["Steel","PVC","Cast Iron"]},
    {"key": "showerhead_aerated", "label": "Showerhead Aerated", "type": "select", "options": ["Yes","No"]},
    {"key": "bath_sink_aerated", "label": "Bathroom Sink Aerated", "type": "select", "options": ["Yes","No"]},
    {"key": "toilet_low_flow", "label": "Toilet Low-Flow", "type": "select", "options": ["Yes","No"]}
  ]},
  {"section": "Electrical", "fields": [
    {"key": "panel_in_unit", "label": "Electric Panel In-Unit", "type": "select", "options": ["Yes","No"]},
    {"key": "panel_amperage", "label": "Panel Amperage", "type": "select", "options": ["60A","100A","125A","150A","200A"]},
    {"key": "panel_voltage", "label": "Panel Voltage", "type": "select", "options": ["120V","240V"]},
    {"key": "lighting_efficient", "label": "Lighting Energy-Efficient", "type": "select", "options": ["Yes","No"]}
  ]},
  {"section": "Amenities - Outdoor", "fields": [
    {"key": "outdoor_pools", "label": "Outdoor Pools", "type": "number", "min": 0, "hint": "#"},
    {"key": "dog_parks", "label": "Dog Parks", "type": "number", "min": 0, "hint": "#"},
    {"key": "dog_park_equipment", "label": "Dog Park Equipment", "type": "select", "options": ["None","Basic","Full"]},
    {"key": "soccer_field", "label": "Soccer (Grass) Field", "type": "select", "options": ["Yes","No"]}
  ]},
  {"section": "Amenities - Indoor", "fields": [
    {"key": "gym_space", "label": "Gym Space", "type": "select", "options": ["Yes","No"]},
    {"key": "gym_equipment", "label": "Gym Equipment", "type": "select", "options": ["Yes","No"]},
    {"key": "laundry_facilities", "label": "Laundry Facilities", "type": "number", "min": 0, "hint": "#"},
    {"key": "machines_per_facility", "label": "Machines per Facility", "type": "number", "min": 0},
    {"key": "indoor_pools", "label": "Indoor Pools", "type": "number", "min": 0, "hint": "#"},
    {"key": "pool_heater", "label": "Pool Heater", "type": "select", "options": ["Yes","No"]},
    {"key": "sport_court_indoor", "label": "Sport Court (Indoor)", "type": "select", "options": ["Yes","No"]}
  ]},
  {"section": "Leasing Office", "fields": [
    {"key": "leasing_office", "label": "Leasing Office", "type": "select", "options": ["Yes","No"]}
  ]}
],
  phase3: [
  {"name": "Soft Costs", "sections": [
    {"name": "General", "items": [
      {"category": "ZONING", "name": "ZONING (LEGAL)", "default_cost_per_item": 25000, "notes": null, "gl_account": "17966: CIP Zoning"},
      {"category": "GENERAL CONDITIONS", "name": "MATERIALS IMPORT TAX/SHIPPING", "default_cost_per_item": null, "notes": null, "gl_account": "17230: CIP Interior - Freight/Overseas Shipping"}
    ]},
    {"name": "DESIGN TEAM CONTRACTS", "items": [
      {"category": "DESIGN", "name": "3D Scanning", "default_cost_per_item": 15000, "notes": null, "gl_account": null},
      {"category": "DESIGN", "name": "Civil Enginner", "default_cost_per_item": 50000, "notes": "usually not needed", "gl_account": null},
      {"category": "DESIGN", "name": "Structural Engineer", "default_cost_per_item": 50000, "notes": "usually not needed", "gl_account": null},
      {"category": "ARCHITECT", "name": "Architect", "default_cost_per_item": 25000, "notes": "if moving walls", "gl_account": null},
      {"category": "ENGINEERING", "name": "Electrical Plans", "default_cost_per_item": 25000, "notes": "if adding electrical (typical for ExStay)", "gl_account": null},
      {"category": "ENGINEERING", "name": "Mechanical Plans", "default_cost_per_item": null, "notes": "usually not needed", "gl_account": null},
      {"category": "ENGINEERING", "name": "Plumbing Plans", "default_cost_per_item": null, "notes": null, "gl_account": null},
      {"category": "ZONING", "name": "Electrical Study", "default_cost_per_item": 10000, "notes": null, "gl_account": null},
      {"category": "DESIGN", "name": "Exterior Designer - Service Fee", "default_cost_per_item": 50000, "notes": null, "gl_account": null},
      {"category": "DESIGN", "name": "Interior Designer - Service fee", "default_cost_per_item": 45000, "notes": null, "gl_account": null}
    ]},
    {"name": "OUTSIDE CONTRACTOR PERMITS", "items": [
      {"category": "PERMITTING", "name": "Demolition Permit", "default_cost_per_item": 500, "notes": null, "gl_account": "17910: CIP License / Permits"},
      {"category": "PERMITTING", "name": "Sprinkler Plans", "default_cost_per_item": 25000, "notes": null, "gl_account": "17917: CIP Base - Fire Protection - Sprinkler"},
      {"category": "PERMITTING", "name": "Pool Permit Design", "default_cost_per_item": 5000, "notes": null, "gl_account": "17700: CIP Architectural"},
      {"category": "PERMITTING", "name": "Signage Design (after AOD)", "default_cost_per_item": 1500, "notes": null, "gl_account": "17560: CIP Signage (5 Yrs)"}
    ]},
    {"name": "PERMITTING", "items": [
      {"category": "PERMITTING", "name": "Permit Expediter", "default_cost_per_item": 75000, "notes": null, "gl_account": "17910: CIP License / Permits"},
      {"category": "PERMITTING", "name": "Temporary Trade Permits", "default_cost_per_item": 1500, "notes": null, "gl_account": "17910: CIP License / Permits"},
      {"category": "PERMITTING", "name": "Permitting Fees", "default_cost_per_item": 35000, "notes": null, "gl_account": "17910: CIP License / Permits"}
    ]},
    {"name": "GENERAL CONDITIONS", "items": [
      {"category": "GENERAL CONDITIONS", "name": "Appliance/Furniture Removal", "default_cost_per_item": 5000, "notes": null, "gl_account": "17805: CIP Common Area FF&E"},
      {"category": "GENERAL CONDITIONS", "name": "Hotel Unit Renovations", "default_cost_per_item": 10000, "notes": "Renovations to operate as hotel", "gl_account": "17940: CIP General Conditions"},
      {"category": "GENERAL CONDITIONS", "name": "Mock-Up Unit Labor and Conversion", "default_cost_per_item": 10000, "notes": null, "gl_account": "17101: CIP Interior - Renovation Labor"},
      {"category": "GENERAL CONDITIONS", "name": "Equipment Rental", "default_cost_per_item": 0, "notes": null, "gl_account": "17935: CIP Rental Equipment"},
      {"category": "GENERAL CONDITIONS", "name": "Storage", "default_cost_per_item": 0, "notes": "Mobile Minis", "gl_account": "17920: CIP Storage"},
      {"category": "GENERAL CONDITIONS", "name": "Construction Office Setup", "default_cost_per_item": 15000, "notes": "on-site office, furniture, internet, etc.", "gl_account": "17940: CIP General Conditions"},
      {"category": "GENERAL CONDITIONS", "name": "Signage - Wrap & New", "default_cost_per_item": 5000, "notes": null, "gl_account": "17560: CIP Signage (5 Yrs)"},
      {"category": "GENERAL CONDITIONS", "name": "Model Unit Furniture", "default_cost_per_item": 2500, "notes": null, "gl_account": "17685: CIP Model Unit Furniture (7 Yrs)"}
    ]},
    {"name": "MATERIALS NEEDED", "items": [
      {"category": "GENERAL CONDITIONS", "name": "Landscaping", "default_cost_per_item": 150, "notes": null, "gl_account": "17940: CIP General Conditions"},
      {"category": "GENERAL CONDITIONS", "name": "Vendor Key Access", "default_cost_per_item": 0, "notes": null, "gl_account": "17501: CIP Vendor Key Access"},
      {"category": "GENERAL CONDITIONS", "name": "Security Cameras", "default_cost_per_item": 150, "notes": null, "gl_account": "17595: CIP Security Cameras"}
    ]}
  ]},
  {"name": "Base Work", "sections": [
    {"name": "SITE WORK", "items": [
      {"category": "BASE WORK", "name": "Grading/Drainage", "default_cost_per_item": 50000, "notes": null, "gl_account": "17350: CIP Site Grading/Drainage (15 Yrs)"},
      {"category": "BASE WORK", "name": "Concrete Pads for Dumpsters", "default_cost_per_item": 5000, "notes": null, "gl_account": "17570: CIP Trash/Dumpster"},
      {"category": "BASE WORK", "name": "Retention Wall", "default_cost_per_item": 50000, "notes": null, "gl_account": "17300: CIP Retaining Wall (15 Yrs)"}
    ]},
    {"name": "FOUNDATION", "items": [
      {"category": "BASE WORK", "name": "Piers", "default_cost_per_item": 2500, "notes": null, "gl_account": "17445: CIP Foundation (15 Yrs)"},
      {"category": "BASE WORK", "name": "Add'l Floor Area", "default_cost_per_item": 0, "notes": null, "gl_account": "17445: CIP Foundation (15 Yrs)"}
    ]},
    {"name": "PLUMBING", "items": [
      {"category": "PLUMBING", "name": "Gas Service", "default_cost_per_item": 50000, "notes": null, "gl_account": "17580: CIP Site Gas Service (15 Yrs)"},
      {"category": "PLUMBING", "name": "New Domestic Water Service", "default_cost_per_item": 50000, "notes": null, "gl_account": "17583: CIP Base - Plumbing - Water"},
      {"category": "PLUMBING", "name": "Domestic Water Service (Extension)", "default_cost_per_item": 50000, "notes": null, "gl_account": "17583: CIP Base - Plumbing - Water"},
      {"category": "PLUMBING", "name": "New Wastewater Service", "default_cost_per_item": 50000, "notes": null, "gl_account": "17585: CIP Sewer Drains/Pipes (15 Yrs)"},
      {"category": "PLUMBING", "name": "Wastewater Service (Extension)", "default_cost_per_item": 50000, "notes": null, "gl_account": "17585: CIP Sewer Drains/Pipes (15 Yrs)"}
    ]},
    {"name": "FIRE PROTECTION", "items": [
      {"category": "FIRE PROTECTION", "name": "Sprinkler - Riser to ROW - Underground", "default_cost_per_item": 50000, "notes": null, "gl_account": "17917: CIP Base - Fire Protection - Sprinkler"},
      {"category": "FIRE PROTECTION", "name": "Sprinkler - ROW Work", "default_cost_per_item": 50000, "notes": "Tap Plan", "gl_account": "17917: CIP Base - Fire Protection - Sprinkler"},
      {"category": "FIRE PROTECTION", "name": "Sprinkler - Hydro Test", "default_cost_per_item": 500, "notes": null, "gl_account": "17917: CIP Base - Fire Protection - Sprinkler"},
      {"category": "FIRE PROTECTION", "name": "Sprinkler - Baseboard Vault Heater", "default_cost_per_item": 2500, "notes": "if needed", "gl_account": "17917: CIP Base - Fire Protection - Sprinkler"}
    ]},
    {"name": "ELECTRICAL", "items": [
      {"category": "ELECTRICAL", "name": "Underground Electrical", "default_cost_per_item": 200000, "notes": "Street to Transformer (Utility Co)", "gl_account": "17371: CIP Base - Electrical"},
      {"category": "ELECTRICAL", "name": "New Transformer", "default_cost_per_item": 100000, "notes": null, "gl_account": "17371: CIP Base - Electrical"},
      {"category": "ELECTRICAL", "name": "New Transformer Pad + Install", "default_cost_per_item": 50000, "notes": "+ Pad & Bollards", "gl_account": "17371: CIP Base - Electrical"},
      {"category": "ELECTRICAL", "name": "Meter Bank to Transformer", "default_cost_per_item": 25000, "notes": null, "gl_account": "17371: CIP Base - Electrical"}
    ]},
    {"name": "PARKING LOT", "items": [
      {"category": "PARKING LOT", "name": "Overlay (Asphalt)", "default_cost_per_item": 100000, "notes": null, "gl_account": "17535: CIP Parking Lot - Asphalt (15 Yrs)"},
      {"category": "PARKING LOT", "name": "Sealcoat", "default_cost_per_item": 25000, "notes": null, "gl_account": "17540: CIP Parking Lot - Surfacing (15 Yrs)"},
      {"category": "PARKING LOT", "name": "Striping", "default_cost_per_item": 5000, "notes": null, "gl_account": "17530: CIP Parking Lot"},
      {"category": "PARKING LOT", "name": "Curb Stops", "default_cost_per_item": 0, "notes": null, "gl_account": "17530: CIP Parking Lot"},
      {"category": "PARKING LOT", "name": "Speed Bumps", "default_cost_per_item": 5000, "notes": null, "gl_account": "17530: CIP Parking Lot"},
      {"category": "PARKING LOT", "name": "Bike Racks", "default_cost_per_item": 5000, "notes": null, "gl_account": "17530: CIP Parking Lot"}
    ]}
  ]},
  {"name": "Building Work", "sections": [
    {"name": "ELECTRICAL", "items": [
      {"category": "ELECTRICAL", "name": "Installing Meter Banks", "default_cost_per_item": 10000, "notes": null, "gl_account": "17370: CIP Building - Electrical Submetering (15 Yrs)"},
      {"category": "ELECTRICAL", "name": "Electric Submeters (materials)", "default_cost_per_item": 0, "notes": "owned by Utility Co", "gl_account": "17370: CIP Building - Electrical Submetering (15 Yrs)"},
      {"category": "ELECTRICAL", "name": "Meter Installation (Labor", "default_cost_per_item": 0, "notes": "done by Utility Co", "gl_account": "17370: CIP Building - Electrical Submetering (15 Yrs)"}
    ]},
    {"name": "FIRE PROTECTION", "items": [
      {"category": "FIRE PROTECTION", "name": "Fire Alarm Monitoring System", "default_cost_per_item": 20000, "notes": null, "gl_account": "17366: CIP Building - Fire Protection - Alarm System"},
      {"category": "FIRE PROTECTION", "name": "Sprinkler - Riser Room", "default_cost_per_item": 25000, "notes": null, "gl_account": "17365: CIP Building - Fire Protection - Sprinklers"},
      {"category": "FIRE PROTECTION", "name": "Sprinkler  - Building Lines ($ By Sqft)", "default_cost_per_item": 0, "notes": "Quantity is in Sqft", "gl_account": "17365: CIP Building - Fire Protection - Sprinklers"},
      {"category": "FIRE PROTECTION", "name": "Sprinkler - Baseboard Heater", "default_cost_per_item": 2500, "notes": null, "gl_account": "17365: CIP Building - Fire Protection - Sprinklers"},
      {"category": "FIRE PROTECTION", "name": "Sprinkler - Fire Assembly Install", "default_cost_per_item": 0, "notes": "per unit item", "gl_account": "17365: CIP Building - Fire Protection - Sprinklers"}
    ]},
    {"name": "PLUMBING", "items": [
      {"category": "PLUMBING", "name": "Water Heater", "default_cost_per_item": 25000, "notes": null, "gl_account": "17587: CIP Building - Plumbing"},
      {"category": "PLUMBING", "name": "Boiler Replacement", "default_cost_per_item": 50000, "notes": null, "gl_account": "17587: CIP Building - Plumbing"},
      {"category": "PLUMBING", "name": "Shift Shutoff Valves", "default_cost_per_item": 5000, "notes": "if needed, usually 1/bldg or per few bldgs", "gl_account": "17587: CIP Building - Plumbing"}
    ]},
    {"name": "FRAMING", "items": [
      {"category": "FRAMING", "name": "Attic Walkway", "default_cost_per_item": 5000, "notes": "Pitched Roof Only", "gl_account": "17390: CIP Building - Framing"},
      {"category": "FRAMING", "name": "Framing Labor + Material", "default_cost_per_item": 5000, "notes": null, "gl_account": "17390: CIP Building - Framing"},
      {"category": "FRAMING", "name": "Additional Unit Conversions - Demised Walls", "default_cost_per_item": 5000, "notes": null, "gl_account": "17390: CIP Building - Framing"}
    ]},
    {"name": "INTERIOR CORRIDORS", "items": [
      {"category": "INTERIOR CORRIDORS", "name": "Interior Hallways Reno", "default_cost_per_item": 15000, "notes": "Carpet, Paint, Fixtures, Doors", "gl_account": "17800: CIP Common Hallways & Stairwells"},
      {"category": "INTERIOR CORRIDORS", "name": "Furniture, Artwork", "default_cost_per_item": 5000, "notes": null, "gl_account": "17800: CIP Common Hallways & Stairwells"}
    ]}
  ]},
  {"name": "Interior", "sections": [
    {"name": "General", "items": [
      {"category": "LABOR", "name": "DEMO LABOR", "default_cost_per_item": null, "notes": null, "gl_account": "17101: CIP Interior - Renovation Labor"}
    ]},
    {"name": "MECHANICAL ROUGH-INS", "items": [
      {"category": "MECHANICAL", "name": "PTAC Units", "default_cost_per_item": null, "notes": "Heat pump Units", "gl_account": "17151: CIP Interior - Mechanical Rough-In"},
      {"category": "MECHANICAL", "name": "Exhaust Fans & Ducts", "default_cost_per_item": null, "notes": "(1/BA, 1-Kithchen)", "gl_account": "17151: CIP Interior - Mechanical Rough-In"},
      {"category": "MECHANICAL", "name": "HVAC Units", "default_cost_per_item": null, "notes": "# of Ground Floor Units", "gl_account": "17151: CIP Interior - Mechanical Rough-In"},
      {"category": "LABOR", "name": "Mechanical Rough-In Labor", "default_cost_per_item": null, "notes": null, "gl_account": "17151: CIP Interior - Mechanical Rough-In"},
      {"category": "FRAMING", "name": "Mechanical Framing", "default_cost_per_item": null, "notes": null, "gl_account": "17151: CIP Interior - Mechanical Rough-In"}
    ]},
    {"name": "ELECTRICAL ROUGH-INS", "items": [
      {"category": "ELECTRICAL", "name": "Breaker Panels", "default_cost_per_item": null, "notes": null, "gl_account": "17202: CIP Interior - Electrical Rough-In"},
      {"category": "ELECTRICAL", "name": "In-Unit Wiring", "default_cost_per_item": null, "notes": "includes add'l outlets", "gl_account": "17202: CIP Interior - Electrical Rough-In"},
      {"category": "LABOR", "name": "Electrical Rough-in Labor", "default_cost_per_item": null, "notes": null, "gl_account": "17202: CIP Interior - Electrical Rough-In"},
      {"category": "FRAMING", "name": "Electrical Framing", "default_cost_per_item": null, "notes": null, "gl_account": "17202: CIP Interior - Electrical Rough-In"}
    ]},
    {"name": "PLUMBING ROUGH-INS", "items": [
      {"category": "PLUMBING", "name": "Plumbing Rough-In Materials", "default_cost_per_item": null, "notes": "piping, valves", "gl_account": "17133: CIP Interior - Plumbing Rough-In"},
      {"category": "PLUMBING", "name": "Plumbing Rough-In Labor", "default_cost_per_item": null, "notes": null, "gl_account": "17133: CIP Interior - Plumbing Rough-In"},
      {"category": "PLUMBING", "name": "HVAC Condensate Drainage Lines", "default_cost_per_item": null, "notes": "Upper Floor Units (not ground #)", "gl_account": "17133: CIP Interior - Plumbing Rough-In"},
      {"category": "DRYWALL/INSULATION", "name": "INSULATION", "default_cost_per_item": null, "notes": null, "gl_account": "17189: CIP Interior - Insulation"}
    ]},
    {"name": "DRYWALL - Materials & Installation", "items": [
      {"category": "DRYWALL/INSULATION", "name": "Materials", "default_cost_per_item": null, "notes": null, "gl_account": "17190: CIP Interior - Drywall"},
      {"category": "DRYWALL/INSULATION", "name": "Labor", "default_cost_per_item": null, "notes": null, "gl_account": "17190: CIP Interior - Drywall"}
    ]},
    {"name": "INTERIOR RENOVATION", "items": [
      {"category": "INTERIOR RENO", "name": "Flooring Materials", "default_cost_per_item": null, "notes": null, "gl_account": "17110: CIP Interior - Flooring Vinyl (5 Yrs)"},
      {"category": "INTERIOR RENO", "name": "Flooring Leveller", "default_cost_per_item": null, "notes": null, "gl_account": "17112: CIP Interior - Floor Leveller"},
      {"category": "INTERIOR RENO", "name": "Smoke & CO2 Alarm Fixtures", "default_cost_per_item": null, "notes": null, "gl_account": "17177: CIP Interior - Smoke/CO2 Alarms Fixtures (5 Yrs)"},
      {"category": "INTERIOR RENO", "name": "Lighting Fixtures", "default_cost_per_item": null, "notes": null, "gl_account": "17175: CIP Interior - Lighting Fixtures (7 Yrs)"},
      {"category": "INTERIOR RENO", "name": "Bathroom Mirrors", "default_cost_per_item": null, "notes": null, "gl_account": "17205: CIP Interior - Bathroom Mirrors (5 Yrs)"},
      {"category": "INTERIOR RENO", "name": "Tub/Shower Surround", "default_cost_per_item": null, "notes": null, "gl_account": "17180: CIP Interior - Tubs/Shower Surround"},
      {"category": "INTERIOR RENO", "name": "Appliances", "default_cost_per_item": null, "notes": null, "gl_account": "17125: CIP Interior - Appliances (5 Yrs)"},
      {"category": "INTERIOR RENO", "name": "Plumbing Fixtures", "default_cost_per_item": null, "notes": null, "gl_account": "17130: CIP Interior - Plumbing Fixtures (7 Yrs)"},
      {"category": "INTERIOR RENO", "name": "Kitchen Countertop", "default_cost_per_item": null, "notes": null, "gl_account": "17135: CIP Interior - Countertops (5 Yrs)"},
      {"category": "INTERIOR RENO", "name": "Kitchen Backsplash", "default_cost_per_item": null, "notes": null, "gl_account": "17140: CIP Interior - Backsplash (7 Yrs)"},
      {"category": "INTERIOR RENO", "name": "Cabinets", "default_cost_per_item": null, "notes": "cabinets OR cab door/pulls", "gl_account": "17145: CIP Interior - Cabinetry (5 Yrs)"},
      {"category": "INTERIOR RENO", "name": "Cab Door + Pulls", "default_cost_per_item": null, "notes": null, "gl_account": "17145: CIP Interior - Cabinetry (5 Yrs)"},
      {"category": "INTERIOR RENO", "name": "Door Hardware", "default_cost_per_item": null, "notes": "doors on the interior of unit (bedroom/bath) not unit door", "gl_account": "17170: CIP Interior - Doors & Hardware"},
      {"category": "INTERIOR RENO", "name": "Trim & Molding", "default_cost_per_item": null, "notes": null, "gl_account": "17225: CIP Interior - Trim & Molding"},
      {"category": "INTERIOR RENO", "name": "Door Repairs", "default_cost_per_item": null, "notes": "doors on the interior of unit (bedroom/bath) not unit door", "gl_account": "17170: CIP Interior - Doors & Hardware"},
      {"category": "INTERIOR RENO", "name": "Blinds", "default_cost_per_item": null, "notes": null, "gl_account": "17122: CIP Interior - Blinds (5 Yrs)"},
      {"category": "INTERIOR RENO", "name": "Paint", "default_cost_per_item": null, "notes": null, "gl_account": "17160: CIP Interior - Paint"},
      {"category": "INTERIOR RENO", "name": "MISC Materials", "default_cost_per_item": null, "notes": null, "gl_account": "17220: CIP Interior - General Building Materials"},
      {"category": "INTERIOR RENO", "name": "Down Units", "default_cost_per_item": null, "notes": null, "gl_account": "17220: CIP Interior - General Building Materials"},
      {"category": "LABOR", "name": "General Renovation Labor", "default_cost_per_item": null, "notes": null, "gl_account": "17101: CIP Interior - Renovation Labor"}
    ]}
  ]},
  {"name": "Exterior", "sections": [
    {"name": "General", "items": [
      {"category": "GENERAL", "name": "TRASH-DUMPSTERS", "default_cost_per_item": 50000, "notes": null, "gl_account": "17570: CIP Trash/Dumpster"},
      {"category": "GENERAL", "name": "STAIRWAYS", "default_cost_per_item": 500, "notes": "Riser Fill In", "gl_account": "17330: CIP Exterior Stairs"},
      {"category": "GENERAL", "name": "SECURITY CAMERAS", "default_cost_per_item": 1500, "notes": "Permanent (leasing, storage, parking)", "gl_account": "17595: CIP Security Cameras"},
      {"category": "GENERAL", "name": "EXTERIOR/COMMON DOORS", "default_cost_per_item": 1000, "notes": "for replacement", "gl_account": "17396: CIP Exterior - Common Doors"}
    ]},
    {"name": "GATE/FENCE REPAIRS", "items": [
      {"category": "FENCES", "name": "Dumpster Corrals", "default_cost_per_item": 500, "notes": null, "gl_account": "17435: CIP Fence/Gate (15 Yrs)"},
      {"category": "FENCES", "name": "New Fence", "default_cost_per_item": 0, "notes": null, "gl_account": "17435: CIP Fence/Gate (15 Yrs)"},
      {"category": "FENCES", "name": "Access Gate", "default_cost_per_item": 5000, "notes": "Security", "gl_account": "17435: CIP Fence/Gate (15 Yrs)"},
      {"category": "FENCES", "name": "Repair Fence", "default_cost_per_item": 1, "notes": null, "gl_account": "17435: CIP Fence/Gate (15 Yrs)"}
    ]},
    {"name": "SIGNAGE", "items": [
      {"category": "SIGNAGE", "name": "Unit Number Signage", "default_cost_per_item": null, "notes": null, "gl_account": "17560: CIP Signage (5 Yrs)"},
      {"category": "SIGNAGE", "name": "Pilon Sign", "default_cost_per_item": 35000, "notes": null, "gl_account": "17560: CIP Signage (5 Yrs)"},
      {"category": "SIGNAGE", "name": "Monument Sign", "default_cost_per_item": 25000, "notes": null, "gl_account": "17560: CIP Signage (5 Yrs)"},
      {"category": "SIGNAGE", "name": "Wayfinding Signs", "default_cost_per_item": 10000, "notes": "General signs, not per unit", "gl_account": "17560: CIP Signage (5 Yrs)"},
      {"category": "SIGNAGE", "name": "Leasing Office Sign", "default_cost_per_item": 10000, "notes": "incl parking signs", "gl_account": "17560: CIP Signage (5 Yrs)"},
      {"category": "SIGNAGE", "name": "Building Signage", "default_cost_per_item": 25000, "notes": null, "gl_account": "17560: CIP Signage (5 Yrs)"}
    ]},
    {"name": "PER UNIT EXTERIOR", "items": [
      {"category": "PER UNIT EXTERIOR", "name": "Exterior Lighting (Per Unit)", "default_cost_per_item": 0, "notes": null, "gl_account": "17480: CIP Exterior - Lighting Per Unit  (5 Yrs)"},
      {"category": "PER UNIT EXTERIOR", "name": "Unit Door", "default_cost_per_item": 0, "notes": null, "gl_account": "17395: CIP Exterior - Doors Per Unit"},
      {"category": "PER UNIT EXTERIOR", "name": "Solar Screen", "default_cost_per_item": 0, "notes": null, "gl_account": "17410: CIP Solar Screens"},
      {"category": "PER UNIT EXTERIOR", "name": "Windows", "default_cost_per_item": 0, "notes": null, "gl_account": "17425: CIP Exterior - Windows"},
      {"category": "PER UNIT EXTERIOR", "name": "Fences/Yards", "default_cost_per_item": 1500, "notes": null, "gl_account": "17435: CIP Fence/Gate (15 Yrs)"}
    ]},
    {"name": "ELECTRICAL - EXTERIOR", "items": [
      {"category": "ELECTRICAL", "name": "Egress lighting and exit signs", "default_cost_per_item": 5, "notes": null, "gl_account": "17499: CIP Exterior - Lighting"},
      {"category": "ELECTRICAL", "name": "Exteriors Flood Lights", "default_cost_per_item": 150, "notes": null, "gl_account": "17499: CIP Exterior - Lighting"},
      {"category": "ELECTRICAL", "name": "Electrical for Landscaping, Pool, Security cameras, and Courtyard", "default_cost_per_item": 500, "notes": null, "gl_account": "17375: CIP Electrical Exterior (15 Yrs)"}
    ]},
    {"name": "ROOF", "items": [
      {"category": "ROOF", "name": "Roof Repairs", "default_cost_per_item": 100000, "notes": null, "gl_account": "17550: CIP Roofing"},
      {"category": "ROOF", "name": "Gutters & Downspouts", "default_cost_per_item": 10000, "notes": null, "gl_account": "17550: CIP Roofing"},
      {"category": "ROOF", "name": "Draft Stop Installation", "default_cost_per_item": 5000, "notes": "Pitched Roof Only", "gl_account": "17550: CIP Roofing"}
    ]},
    {"name": "RAILINGS", "items": [
      {"category": "WALKWAYS", "name": "Railings", "default_cost_per_item": 1.5, "notes": "Repair/Replace", "gl_account": "17325: CIP Exterior - Railings"},
      {"category": "WALKWAYS", "name": "Sandblasting - Labor", "default_cost_per_item": 10000, "notes": null, "gl_account": "17325: CIP Exterior - Railings"},
      {"category": "WALKWAYS", "name": "Panels - Material", "default_cost_per_item": 5, "notes": null, "gl_account": "17325: CIP Exterior - Railings"},
      {"category": "WALKWAYS", "name": "Welder - Labor", "default_cost_per_item": 5000, "notes": null, "gl_account": "17325: CIP Exterior - Railings"}
    ]},
    {"name": "WALKWAYS", "items": [
      {"category": "WALKWAYS", "name": "New Framing - Materials", "default_cost_per_item": 250000, "notes": null, "gl_account": "17335: CIP Exterior Walkways"},
      {"category": "WALKWAYS", "name": "New Framing - Labor", "default_cost_per_item": 250000, "notes": null, "gl_account": "17335: CIP Exterior Walkways"},
      {"category": "WALKWAYS", "name": "Concrete Walks - Finish Coat", "default_cost_per_item": 50000, "notes": null, "gl_account": "17335: CIP Exterior Walkways"},
      {"category": "WALKWAYS", "name": "Welder", "default_cost_per_item": 5000, "notes": null, "gl_account": "17335: CIP Exterior Walkways"},
      {"category": "WALKWAYS", "name": "Walkway Extension", "default_cost_per_item": 15000, "notes": null, "gl_account": "17335: CIP Exterior Walkways"}
    ]},
    {"name": "SIDING", "items": [
      {"category": "SIDING", "name": "Sandblasting", "default_cost_per_item": 100000, "notes": "Materials & Install", "gl_account": "17415: CIP Siding"},
      {"category": "SIDING", "name": "Exterior Paint", "default_cost_per_item": 100000, "notes": "Materials & Install", "gl_account": "17515: CIP Exterior Paint"},
      {"category": "SIDING", "name": "Siding", "default_cost_per_item": 100000, "notes": "Materials & Install (w/ Paint)", "gl_account": "17420: CIP Siding (Vinyl) (5 Yrs)"},
      {"category": "SIDING", "name": "Stucco", "default_cost_per_item": 100000, "notes": null, "gl_account": "17423: CIP Exterior - Siding (Stucco)"}
    ]},
    {"name": "DESIGN ELEMENT", "items": [
      {"category": "CURB APPEAL", "name": "Steel Frame", "default_cost_per_item": 150000, "notes": null, "gl_account": "17400: CIP Façade"},
      {"category": "CURB APPEAL", "name": "Metal Panels", "default_cost_per_item": 25000, "notes": "Materials & Install", "gl_account": "17400: CIP Façade"},
      {"category": "CURB APPEAL", "name": "Cold Form Framing", "default_cost_per_item": 25000, "notes": null, "gl_account": "17400: CIP Façade"},
      {"category": "CURB APPEAL", "name": "Porte Cochere", "default_cost_per_item": 25000, "notes": null, "gl_account": "17400: CIP Façade"},
      {"category": "CURB APPEAL", "name": "Store Front/Curtain Walls", "default_cost_per_item": 25000, "notes": null, "gl_account": "17403: CIP Exterior - Store Front - Curtain Walls"}
    ]},
    {"name": "LANDSCAPING", "items": [
      {"category": "CURB APPEAL", "name": "Planters, Welder, Hedge", "default_cost_per_item": 25000, "notes": null, "gl_account": "17470: CIP Landscaping"},
      {"category": "CURB APPEAL", "name": "Front Curb Appeal", "default_cost_per_item": 50000, "notes": null, "gl_account": "17470: CIP Landscaping"},
      {"category": "CURB APPEAL", "name": "Irrigation", "default_cost_per_item": 25000, "notes": null, "gl_account": "17470: CIP Landscaping"}
    ]}
  ]},
  {"name": "Amenities/Common Areas", "sections": [
    {"name": "General", "items": [
      {"category": "COMMON AREAS", "name": "LAUNDRY ROOMS", "default_cost_per_item": 15000, "notes": null, "gl_account": "17830: CIP Laundry Room"},
      {"category": "COMMON AREAS", "name": "COMMON BATHROOMS", "default_cost_per_item": 25000, "notes": null, "gl_account": "17690: CIP Common - Common Bathrooms"},
      {"category": "AMENITIES", "name": "DOG PARK", "default_cost_per_item": 25000, "notes": null, "gl_account": "17620: CIP Dog Park (15 Yrs)"},
      {"category": "AMENITIES", "name": "FIRE PIT", "default_cost_per_item": 15000, "notes": null, "gl_account": "17615: CIP Fire Pit/BBQ"},
      {"category": "AMENITIES", "name": "SPORT COURT", "default_cost_per_item": 50000, "notes": null, "gl_account": "17650: CIP Playground (15 Yrs)"},
      {"category": "AMENITIES", "name": "OUTDOOR KITCHEN", "default_cost_per_item": 30000, "notes": null, "gl_account": "17660: CIP Pool - Grill/Kitchen (5 Yrs)"}
    ]},
    {"name": "GYM", "items": [
      {"category": "AMENITIES", "name": "Build-Out", "default_cost_per_item": 30000, "notes": null, "gl_account": "17630: CIP Fitness Center Build Out"},
      {"category": "AMENITIES", "name": "Equipment", "default_cost_per_item": 30000, "notes": null, "gl_account": "17625: CIP Fitness Center - Equipment (7 Yrs)"}
    ]},
    {"name": "OTHER AMENITIES", "items": [
      {"category": "AMENITIES", "name": "Theater", "default_cost_per_item": 30000, "notes": null, "gl_account": "17642: CIP Common - Common Amenities Other"},
      {"category": "AMENITIES", "name": "Karaoke", "default_cost_per_item": 30000, "notes": null, "gl_account": "17642: CIP Common - Common Amenities Other"},
      {"category": "AMENITIES", "name": "Game Room", "default_cost_per_item": 30000, "notes": null, "gl_account": "17642: CIP Common - Common Amenities Other"}
    ]},
    {"name": "ELEVATOR", "items": [
      {"category": "ELEVATOR", "name": "Demo", "default_cost_per_item": 10000, "notes": null, "gl_account": "17385: CIP Elevator"},
      {"category": "ELEVATOR", "name": "Hoistway", "default_cost_per_item": 10000, "notes": null, "gl_account": "17385: CIP Elevator"},
      {"category": "ELEVATOR", "name": "Cab", "default_cost_per_item": 25000, "notes": null, "gl_account": "17385: CIP Elevator"},
      {"category": "ELEVATOR", "name": "Machinery", "default_cost_per_item": 25000, "notes": null, "gl_account": "17385: CIP Elevator"},
      {"category": "ELEVATOR", "name": "Sump Pump", "default_cost_per_item": 10000, "notes": null, "gl_account": "17385: CIP Elevator"}
    ]},
    {"name": "POOL", "items": [
      {"category": "POOLS", "name": "Pool Insert/Decking", "default_cost_per_item": 35000, "notes": null, "gl_account": "17657: CIP Common - Pool Decking"},
      {"category": "POOLS", "name": "Pool Machinery", "default_cost_per_item": 35000, "notes": null, "gl_account": "17675: CIP Pool - Machinery"},
      {"category": "POOLS", "name": "Tile", "default_cost_per_item": 35000, "notes": null, "gl_account": "17670: CIP Pool - Surface & Shell"},
      {"category": "POOLS", "name": "Furniture", "default_cost_per_item": 35000, "notes": null, "gl_account": "17655: CIP Pool - Furniture (7 Yrs)"},
      {"category": "POOLS", "name": "Concrete in Courtyard - retaining wall", "default_cost_per_item": 35000, "notes": null, "gl_account": "17300: CIP Retaining Wall (15 Yrs)"},
      {"category": "POOLS", "name": "footers/columns in courtyard", "default_cost_per_item": 35000, "notes": null, "gl_account": "17300: CIP Retaining Wall (15 Yrs)"}
    ]},
    {"name": "CLUBHOUSE/LOBBY", "items": [
      {"category": "CLUBHOUSE/LOBBY", "name": "Clubhouse Demo", "default_cost_per_item": 10000, "notes": null, "gl_account": "17635: CIP Leasing Center Build Out"},
      {"category": "CLUBHOUSE/LOBBY", "name": "Framing", "default_cost_per_item": 25000, "notes": "Materials & Labor", "gl_account": "17635: CIP Leasing Center Build Out"},
      {"category": "CLUBHOUSE/LOBBY", "name": "Mechanical", "default_cost_per_item": 25000, "notes": "Materials & Labor", "gl_account": "17635: CIP Leasing Center Build Out"},
      {"category": "CLUBHOUSE/LOBBY", "name": "Electrical", "default_cost_per_item": 25000, "notes": "Materials & Labor", "gl_account": "17635: CIP Leasing Center Build Out"},
      {"category": "CLUBHOUSE/LOBBY", "name": "Plumbing", "default_cost_per_item": 25000, "notes": "Materials & Labor", "gl_account": "17635: CIP Leasing Center Build Out"},
      {"category": "CLUBHOUSE/LOBBY", "name": "Drywall", "default_cost_per_item": 10000, "notes": "Materials & Labor", "gl_account": "17635: CIP Leasing Center Build Out"},
      {"category": "CLUBHOUSE/LOBBY", "name": "Finishes", "default_cost_per_item": 25000, "notes": "Materials & Labor", "gl_account": "17635: CIP Leasing Center Build Out"},
      {"category": "CLUBHOUSE/LOBBY", "name": "Interior Designer - FF&E", "default_cost_per_item": 25000, "notes": null, "gl_account": "17805: CIP Common Area FF&E"},
      {"category": "CLUBHOUSE/LOBBY", "name": "Sound System", "default_cost_per_item": 10000, "notes": null, "gl_account": "17645: CIP Clubhouse - Sound System (5 Yrs)"},
      {"category": "CLUBHOUSE/LOBBY", "name": "Leasing Center Tech Equipment", "default_cost_per_item": 6000, "notes": null, "gl_account": "17955: CIP Office/Computer Equipment (5 Yrs)"},
      {"category": "CLUBHOUSE/LOBBY", "name": "Business Center", "default_cost_per_item": 10000, "notes": null, "gl_account": "17955: CIP Office/Computer Equipment (5 Yrs)"}
    ]},
    {"name": "MAIL CENTER", "items": [
      {"category": "COMMON AREAS", "name": "Mailboxes", "default_cost_per_item": 25000, "notes": null, "gl_account": "17505: CIP Mailbox"},
      {"category": "COMMON AREAS", "name": "Package Boxes", "default_cost_per_item": 5000, "notes": null, "gl_account": "17505: CIP Mailbox"}
    ]}
  ]}
]
};
