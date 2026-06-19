// Auto-generated schema. Re-run build_schema.py to regenerate.
window.SCHEMA = {
  phase1: [
  {
    "section": "Identity",
    "fields": [
      {
        "key": "prop_name",
        "label": "Property Name",
        "type": "text",
        "required": true
      },
      {
        "key": "mailing_address",
        "label": "Mailing Address",
        "type": "text"
      },
      {
        "key": "city",
        "label": "City",
        "type": "text"
      },
      {
        "key": "state",
        "label": "State",
        "type": "select",
        "options": [
          "AL",
          "AK",
          "AZ",
          "AR",
          "CA",
          "CO",
          "CT",
          "DE",
          "FL",
          "GA",
          "HI",
          "ID",
          "IL",
          "IN",
          "IA",
          "KS",
          "KY",
          "LA",
          "ME",
          "MD",
          "MA",
          "MI",
          "MN",
          "MS",
          "MO",
          "MT",
          "NE",
          "NV",
          "NH",
          "NJ",
          "NM",
          "NY",
          "NC",
          "ND",
          "OH",
          "OK",
          "OR",
          "PA",
          "RI",
          "SC",
          "SD",
          "TN",
          "TX",
          "UT",
          "VT",
          "VA",
          "WA",
          "WV",
          "WI",
          "WY"
        ]
      },
      {
        "key": "zip",
        "label": "ZIP",
        "type": "text",
        "pattern": "[0-9]{5}"
      },
      {
        "key": "maps_link",
        "type": "maps_link",
        "label": "\ud83d\udccd View on Google Maps",
        "addr_expr": "mailing_address ? [mailing_address, city, state, zip].filter(Boolean).join(', ') : ''"
      },
      {
        "key": "property_type",
        "label": "Property Type",
        "type": "select",
        "options": [
          "MFVA",
          "EXSTAY"
        ]
      },
      {
        "key": "year_built",
        "label": "Year Built",
        "type": "number",
        "min": 1900,
        "max": 2026
      }
    ]
  },
  {
    "section": "Units & Area",
    "fields": [
      {
        "key": "mf_units",
        "label": "Number of MF Units",
        "type": "number",
        "min": 0
      },
      {
        "key": "current_occupancy",
        "label": "Current Occupancy",
        "type": "number",
        "min": 0,
        "max": 1,
        "step": 0.01,
        "hint": "Decimal (0.75 = 75%)"
      },
      {
        "key": "mf_rsf",
        "label": "Multifamily RSF",
        "type": "number",
        "min": 0
      },
      {
        "key": "commercial_rsf",
        "label": "Commercial RSF",
        "type": "number",
        "min": 0
      },
      {
        "key": "common_sf",
        "label": "Common (non-rentable) Sqft",
        "type": "number",
        "min": 0,
        "decimals": 0
      },
      {
        "key": "overall_rsf",
        "label": "Overall RSF",
        "type": "number",
        "computed": "mf_rsf + commercial_rsf + common_sf",
        "decimals": 0
      },
      {
        "key": "land_sf",
        "label": "Land Sqft",
        "type": "number",
        "min": 0,
        "decimals": 0,
        "partner": {
          "target": "land_acres",
          "expr": "land_sf / 43560"
        }
      },
      {
        "key": "land_acres",
        "label": "Land Acreage",
        "type": "number",
        "min": 0,
        "decimals": 2,
        "partner": {
          "target": "land_sf",
          "expr": "land_acres * 43560"
        }
      }
    ]
  },
  {
    "section": "Building & Site",
    "fields": [
      {
        "key": "num_buildings",
        "label": "# Buildings",
        "type": "number",
        "min": 0
      },
      {
        "key": "vertical_floors",
        "label": "# Vertical Floors (Per Building)",
        "type": "number",
        "min": 0
      },
      {
        "key": "roofs_connected",
        "label": "Roofs Connected?",
        "type": "select",
        "options": [
          "Yes",
          "No"
        ],
        "show_if": "num_buildings > 1"
      },
      {
        "key": "elevators_yn",
        "label": "Elevators?",
        "type": "select",
        "options": [
          "Yes",
          "No"
        ]
      },
      {
        "key": "elevator_year_install",
        "label": "Year Installed",
        "type": "number",
        "min": 1900,
        "max": 2100,
        "show_if": "elevators_yn === 'Yes'"
      },
      {
        "key": "elevator_passenger",
        "label": "Passenger #",
        "type": "number",
        "min": 0,
        "show_if": "elevators_yn === 'Yes'"
      },
      {
        "key": "elevator_freight",
        "label": "Freight #",
        "type": "number",
        "min": 0,
        "show_if": "elevators_yn === 'Yes'"
      },
      {
        "key": "parking_spots_existing",
        "label": "# Parking Spots",
        "type": "number",
        "min": 0
      },
      {
        "key": "private_yard_existing",
        "label": "# Private Yards",
        "type": "number",
        "min": 0
      }
    ]
  },
  {
    "section": "Survey Site Specs",
    "fields": [
      {
        "key": "parking_spots_hc",
        "label": "# Accessible (HC) Parking Stalls",
        "type": "number",
        "min": 0,
        "hint": "Of total parking above"
      },
      {
        "key": "site_perimeter_lf",
        "label": "Site Perimeter",
        "type": "number",
        "min": 0,
        "hint": "Linear Ft (sum of boundary segments)"
      },
      {
        "key": "parking_lot_sf",
        "label": "Parking Lot SF",
        "type": "number",
        "min": 0,
        "hint": "Paved area curb-to-curb (stalls + drives)"
      },
      {
        "key": "total_footprint_sf",
        "label": "Total Building Footprint SF",
        "type": "number",
        "min": 0,
        "hint": "Sum across all buildings"
      },
      {
        "key": "total_roof_sf",
        "label": "Total Roof SF",
        "type": "number",
        "min": 0,
        "hint": "Pitch-adjusted (footprint \u00f7 cos(pitch))"
      },
      {
        "key": "total_facade_sf",
        "label": "Total Facade SF",
        "type": "number",
        "min": 0,
        "hint": "Perimeter \u00d7 height, net of openings"
      },
      {
        "key": "sidewalks_other_paved_sf",
        "label": "Sidewalks / Other Paved SF",
        "type": "number",
        "min": 0,
        "hint": "Walks, pads, dumpster aprons"
      },
      {
        "key": "landscaping_sf",
        "label": "Landscaping / Pervious SF",
        "type": "number",
        "min": 0,
        "hint": "Residual = land \u2212 bldg \u2212 parking \u2212 sidewalks; override if known"
      },
      {
        "key": "landscaping_pct_info",
        "type": "info",
        "expr": "`Pervious cover: ${land_sf > 0 ? ((landscaping_sf||0)/land_sf*100).toFixed(1) : 0}% of site`"
      },
      {
        "key": "fencing_notes",
        "label": "Fencing Notes",
        "type": "textarea",
        "hint": "Type / LF / location \u00b7 \"n/a\" if none"
      },
      {
        "key": "gates_notes",
        "label": "Gates Notes",
        "type": "textarea",
        "hint": "Count / type / location \u00b7 \"n/a\" if none"
      }
    ]
  }
],
  phase2: [
  {
    "section": "Basics",
    "fields": [
      {
        "key": "construction_type",
        "label": "Construction Type",
        "type": "select",
        "options": [
          "Wood Frame",
          "Concrete",
          "Steel"
        ]
      },
      {
        "key": "flooring",
        "label": "Flooring",
        "type": "select",
        "options": [
          "Vinyl Plank",
          "Hardwood",
          "Carpeted",
          "Hard 1st + Carpet 2nd"
        ]
      },
      {
        "key": "roof_shape",
        "label": "Roof Shape",
        "type": "select",
        "options": [
          "Pitched",
          "Flat"
        ]
      },
      {
        "key": "roof_material",
        "label": "Roof Material",
        "type": "select",
        "options": [
          "TPO",
          "Shingles",
          "Torchdown",
          "Bitumen",
          "Built-Up",
          "EPDM",
          "PVC",
          "Metal",
          "Tile"
        ]
      },
      {
        "key": "corridor",
        "label": "Corridor",
        "type": "select",
        "options": [
          "Interior (Hallway)",
          "Exterior (Walkway)"
        ]
      },
      {
        "key": "garage",
        "label": "Garage",
        "type": "select",
        "options": [
          "None",
          "Attached",
          "Detached Single",
          "Detached Group"
        ]
      },
      {
        "key": "parking_spots_to_add",
        "label": "Parking Spots to Add",
        "type": "number",
        "min": 0
      },
      {
        "key": "parking_type",
        "label": "Type",
        "type": "select",
        "options": [
          "Restripe",
          "New Cover"
        ],
        "show_if": "parking_spots_to_add > 0"
      },
      {
        "key": "parking_suggestion",
        "type": "info",
        "expr": "`Suggestion: ${(parking_spots_to_add||0) <= 0.05 * (p1_parking_spots_existing||0) ? 'Restripe' : 'New Cover'} (adding ${parking_spots_to_add||0} \u2248 ${(p1_parking_spots_existing||0) ? Math.round(100*(parking_spots_to_add||0)/p1_parking_spots_existing) : 0}% of existing ${p1_parking_spots_existing||0})`",
        "show_if": "parking_spots_to_add > 0"
      },
      {
        "key": "parking_cost_info",
        "type": "info",
        "expr": "`Estimated cost: $${(parking_type === 'Restripe' ? Math.round((p1_parking_spots_existing||0)/100*5000) : (parking_type === 'New Cover' ? (parking_spots_to_add||0)*300*4 : 0)).toLocaleString()}` + (parking_type === 'Restripe' ? '  (Restripe: $5,000 per 100 existing spots)' : (parking_type === 'New Cover' ? '  (New Cover: $4/Sqft \u00d7 300 Sqft/spot)' : ''))",
        "show_if": "parking_spots_to_add > 0"
      }
    ]
  },
  {
    "section": "Exteriors",
    "fields": [
      {
        "key": "landscape_level",
        "label": "Landscape Level",
        "type": "select",
        "options": [
          "None",
          "Low",
          "Medium",
          "High"
        ]
      },
      {
        "key": "new_railing_lf",
        "label": "New Railing",
        "type": "number",
        "min": 0,
        "hint": "Linear Ft"
      },
      {
        "key": "new_railing_panels_sqft",
        "label": "New Railing Panels",
        "type": "number",
        "computed": "new_railing_lf * 3",
        "decimals": 0,
        "hint": "Auto: Linear Ft \u00d7 36\" (Sqft)"
      },
      {
        "key": "private_yards_add",
        "label": "Private Yards to Add",
        "type": "number",
        "min": 0,
        "hint": "# Yards"
      },
      {
        "key": "yard_perimeter_lf",
        "label": "Yard Perimeter",
        "type": "number",
        "min": 0,
        "hint": "Linear Ft"
      },
      {
        "key": "balconies",
        "label": "Balconies",
        "type": "select",
        "options": [
          "Yes",
          "No"
        ]
      },
      {
        "key": "patios",
        "label": "Patios",
        "type": "select",
        "options": [
          "Yes",
          "No"
        ]
      },
      {
        "key": "patio_type",
        "label": "Patio Type",
        "type": "select",
        "options": [
          "Front - Sliding Door",
          "Back - Sliding Door",
          "Front - Swinging Door",
          "Back - Swinging Door"
        ],
        "show_if": "patios === 'Yes'"
      }
    ]
  },
  {
    "section": "Common Interiors",
    "fields": [
      {
        "key": "hallway_length",
        "label": "Interior Hallway Dimensions \u2014 Length",
        "type": "number",
        "min": 0,
        "hint": "Feet"
      },
      {
        "key": "hallway_width",
        "label": "Interior Hallway Dimensions \u2014 Width",
        "type": "number",
        "min": 0,
        "hint": "Feet"
      },
      {
        "key": "hallway_info",
        "type": "info",
        "expr": "`Area per hallway: ${Math.round((hallway_length||0)*(hallway_width||0)).toLocaleString()} Sqft \u00b7 Total hallways: ${(p1_num_buildings||0)*(p1_vertical_floors||0)} (${p1_num_buildings||0} bldgs \u00d7 ${p1_vertical_floors||0} floors)`"
      },
      {
        "key": "fencing_existing_lf",
        "label": "Existing Fencing",
        "type": "number",
        "min": 0,
        "hint": "Linear Ft"
      },
      {
        "key": "fencing_needed_lf",
        "label": "Needed Fencing",
        "type": "number",
        "min": 0,
        "hint": "Linear Ft"
      }
    ]
  },
  {
    "section": "Mechanical (HVAC)",
    "fields": [
      {
        "key": "cooling",
        "label": "Cooling",
        "type": "select",
        "options": [
          "Ind. Condenser",
          "Chiller FCUs",
          "PTAC",
          "VTAC"
        ]
      },
      {
        "key": "heating",
        "label": "Heating",
        "type": "select",
        "options": [
          "Ind. Furnace",
          "Boiler Radiator",
          "Boiler FCUs",
          "PTAC",
          "VTAC"
        ]
      }
    ]
  },
  {
    "section": "Plumbing",
    "fields": [
      {
        "key": "hot_water_type",
        "label": "Hot Water Type",
        "type": "select",
        "options": [
          "HWH-Gas",
          "HWH-Elec",
          "Boiler"
        ]
      },
      {
        "key": "hot_water_count",
        "label": "# Hot Water",
        "type": "number",
        "min": 0,
        "dynamic_label": "`# ${hot_water_type || '[Hot Water Type]'}`"
      },
      {
        "key": "plumbing_pipes",
        "label": "Plumbing Pipes",
        "type": "select",
        "options": [
          "Steel",
          "PVC",
          "Cast Iron"
        ]
      },
      {
        "key": "showerhead_aerated",
        "label": "Showerhead Aerated",
        "type": "select",
        "options": [
          "Yes",
          "No"
        ]
      },
      {
        "key": "bath_sink_aerated",
        "label": "Bathroom Sink Aerated",
        "type": "select",
        "options": [
          "Yes",
          "No"
        ]
      },
      {
        "key": "toilet_low_flow",
        "label": "Toilet Low-Flow",
        "type": "select",
        "options": [
          "Yes",
          "No"
        ]
      }
    ]
  },
  {
    "section": "Electrical",
    "fields": [
      {
        "key": "panel_in_unit",
        "label": "Electric Panel In-Unit",
        "type": "select",
        "options": [
          "Yes",
          "No"
        ]
      },
      {
        "key": "panel_amperage",
        "label": "Panel Amperage",
        "type": "select",
        "options": [
          "60A",
          "100A",
          "125A",
          "150A",
          "200A"
        ]
      },
      {
        "key": "panel_voltage",
        "label": "Panel Voltage",
        "type": "select",
        "options": [
          "120V",
          "240V"
        ]
      },
      {
        "key": "lighting_efficient",
        "label": "Lighting Energy-Efficient",
        "type": "select",
        "options": [
          "Yes",
          "No"
        ]
      }
    ]
  },
  {
    "section": "Amenities - Outdoor",
    "fields": [
      {
        "key": "outdoor_pools",
        "label": "Outdoor Pools",
        "type": "number",
        "min": 0,
        "hint": "#"
      },
      {
        "key": "dog_parks",
        "label": "Dog Parks",
        "type": "number",
        "min": 0,
        "hint": "#"
      },
      {
        "key": "dog_park_equipment",
        "label": "Dog Park Equipment",
        "type": "select",
        "options": [
          "None",
          "Basic",
          "Full"
        ]
      },
      {
        "key": "soccer_field",
        "label": "Soccer (Grass) Field",
        "type": "select",
        "options": [
          "Yes",
          "No"
        ]
      }
    ]
  },
  {
    "section": "Amenities - Indoor",
    "fields": [
      {
        "key": "gym_space",
        "label": "Gym Space",
        "type": "select",
        "options": [
          "Yes",
          "No"
        ]
      },
      {
        "key": "gym_equipment",
        "label": "Gym Equipment",
        "type": "select",
        "options": [
          "Yes",
          "No"
        ]
      },
      {
        "key": "laundry_facilities",
        "label": "Laundry Facilities",
        "type": "number",
        "min": 0,
        "hint": "#"
      },
      {
        "key": "machines_per_facility",
        "label": "Machines per Facility",
        "type": "number",
        "min": 0
      },
      {
        "key": "indoor_pools",
        "label": "Indoor Pools",
        "type": "number",
        "min": 0,
        "hint": "#"
      },
      {
        "key": "pool_heater",
        "label": "Pool Heater",
        "type": "select",
        "options": [
          "Yes",
          "No"
        ]
      },
      {
        "key": "sport_court_indoor",
        "label": "Sport Court (Indoor)",
        "type": "select",
        "options": [
          "Yes",
          "No"
        ]
      }
    ]
  },
  {
    "section": "Leasing Office",
    "fields": [
      {
        "key": "leasing_office",
        "label": "Leasing Office",
        "type": "select",
        "options": [
          "Yes",
          "No"
        ]
      },
      {
        "key": "leasing_office_addons",
        "label": "Leasing Office Add-Ons",
        "type": "multiselect",
        "options": [
          "Sound System",
          "Business Center"
        ],
        "hint": "Select all that apply"
      }
    ]
  }
],
  phase3: [
  {
    "name": "Soft Costs",
    "sections": [
      {
        "name": "General",
        "items": [
          {
            "name": "ZONING (LEGAL)",
            "default_cost_per_item": 25000.0,
            "notes": null,
            "gl_account": "17966: CIP Zoning",
            "default_qty_type": "Allowance"
          }
        ]
      },
      {
        "name": "PLAN DESIGN",
        "items": [
          {
            "name": "3D Scanning",
            "default_cost_per_item": 15000.0,
            "notes": null,
            "gl_account": "17910 - CIP License / Permits",
            "default_qty_type": "Allowance"
          },
          {
            "name": "Civil Engineer",
            "default_cost_per_item": 50000.0,
            "notes": "usually not needed",
            "gl_account": "17910 - CIP License / Permits",
            "default_qty_type": "Allowance"
          },
          {
            "name": "Structural Engineer",
            "default_cost_per_item": 50000.0,
            "notes": "usually not needed",
            "gl_account": "17707 - CIP Structural Design",
            "default_qty_type": "Allowance"
          },
          {
            "name": "Architect",
            "default_cost_per_item": 25000.0,
            "notes": "if moving walls",
            "gl_account": "17910 - CIP License / Permits",
            "default_qty_type": "Allowance"
          },
          {
            "name": "Electrical Plans",
            "default_cost_per_item": null,
            "notes": "if adding electrical (typical for ExStay)",
            "gl_account": "17706 - CIP MEP Design",
            "default_qty_type": "Allowance",
            "options": [
              {
                "finish": "All Existing+New",
                "default_cost": 25000.0
              },
              {
                "finish": "New Only",
                "default_cost": 10000.0
              },
              {
                "finish": "Other",
                "default_cost": 2500.0
              }
            ]
          },
          {
            "name": "Mechanical Plans",
            "default_cost_per_item": 25000.0,
            "notes": "usually not needed",
            "gl_account": "17706 - CIP MEP Design",
            "default_qty_type": "Allowance"
          },
          {
            "name": "Plumbing Plans",
            "default_cost_per_item": 25000.0,
            "notes": null,
            "gl_account": "17706 - CIP MEP Design",
            "default_qty_type": "Allowance"
          },
          {
            "name": "Electrical Study",
            "default_cost_per_item": 10000.0,
            "notes": null,
            "gl_account": "17710 - CIP Design Work",
            "default_qty_type": "Allowance"
          },
          {
            "name": "Exterior Designer - Fee",
            "default_cost_per_item": 50000.0,
            "notes": null,
            "gl_account": "17004 - Design",
            "default_qty_type": "Allowance"
          },
          {
            "name": "Interior Designer - Fee",
            "default_cost_per_item": 45000.0,
            "notes": null,
            "gl_account": "17004 - Design",
            "default_qty_type": "Allowance"
          }
        ]
      },
      {
        "name": "OTHER PERMITS",
        "items": [
          {
            "name": "Demolition Permit",
            "default_cost_per_item": 500.0,
            "notes": null,
            "gl_account": "17910: CIP License / Permits",
            "default_qty_type": "Allowance"
          },
          {
            "name": "Sprinkler Plans",
            "default_cost_per_item": null,
            "notes": null,
            "gl_account": "17917: CIP Base - Fire Protection - Sprinkler",
            "default_qty_type": "Allowance",
            "options": [
              {
                "finish": "All Existing+New",
                "default_cost": 35000.0
              },
              {
                "finish": "Existing Only",
                "default_cost": 25000.0
              },
              {
                "finish": "New Only",
                "default_cost": 5000.0
              },
              {
                "finish": "Other",
                "default_cost": 2500.0
              }
            ]
          },
          {
            "name": "Pool Plans",
            "default_cost_per_item": 5000.0,
            "notes": null,
            "gl_account": "17700: CIP Architectural",
            "default_qty_type": "Allowance"
          },
          {
            "name": "Signage Plans",
            "default_cost_per_item": 1500.0,
            "notes": null,
            "gl_account": "17560: CIP Signage (5 Yrs)",
            "default_qty_type": "Allowance"
          }
        ]
      },
      {
        "name": "PERMITTING",
        "items": [
          {
            "name": "Permit Expediter",
            "default_cost_per_item": 75000.0,
            "notes": null,
            "gl_account": "17910: CIP License / Permits",
            "default_qty_type": "Allowance"
          },
          {
            "name": "Trade Permits",
            "default_cost_per_item": 1500.0,
            "notes": null,
            "gl_account": "17910: CIP License / Permits",
            "default_qty_type": "Building"
          },
          {
            "name": "Permitting Fees",
            "default_cost_per_item": 35000.0,
            "notes": null,
            "gl_account": "17910: CIP License / Permits",
            "default_qty_type": "Building"
          }
        ]
      },
      {
        "name": "GENERAL CONDITIONS",
        "items": [
          {
            "name": "Furniture Removal",
            "default_cost_per_item": 5000.0,
            "notes": null,
            "gl_account": "17805: CIP Common Area FF&E",
            "default_qty_type": "Allowance"
          },
          {
            "name": "Hotel Unit Renovations",
            "default_cost_per_item": 10000.0,
            "notes": "Renovations to operate as hotel",
            "gl_account": "17940: CIP General Conditions",
            "default_qty_type": "Allowance"
          },
          {
            "name": "Mock-Up Unit",
            "default_cost_per_item": null,
            "notes": null,
            "gl_account": "17101: CIP Interior - Renovation Labor",
            "default_qty_type": "Allowance",
            "options": [
              {
                "finish": "Fully Furnished",
                "default_cost": 15000.0
              },
              {
                "finish": "Renovation Only",
                "default_cost": 5000.0
              }
            ]
          },
          {
            "name": "Equipment Rental",
            "default_cost_per_item": 5000.0,
            "notes": null,
            "gl_account": "17935: CIP Rental Equipment",
            "default_qty_type": "Month"
          },
          {
            "name": "Storage",
            "default_cost_per_item": 2500.0,
            "notes": "Mobile Minis",
            "gl_account": "17920: CIP Storage",
            "default_qty_type": "Month"
          },
          {
            "name": "Constr. Office Setup",
            "default_cost_per_item": 15000.0,
            "notes": "on-site office, furniture, internet, etc.",
            "gl_account": "17940: CIP General Conditions",
            "default_qty_type": "Allowance"
          },
          {
            "name": "Signage - Wrap & New",
            "default_cost_per_item": 5000.0,
            "notes": null,
            "gl_account": "17560: CIP Signage (5 Yrs)",
            "default_qty_type": "Allowance"
          },
          {
            "name": "Model Unit Furniture",
            "default_cost_per_item": 2500.0,
            "notes": null,
            "gl_account": "17685: CIP Model Unit Furniture (7 Yrs)",
            "default_qty_type": "Allowance"
          }
        ]
      },
      {
        "name": "MATERIALS NEEDED",
        "items": [
          {
            "name": "Landscaping",
            "default_cost_per_item": 150.0,
            "notes": null,
            "gl_account": "17940: CIP General Conditions",
            "default_qty_type": "Sqft"
          },
          {
            "name": "Vendor Key Access",
            "default_cost_per_item": 150.0,
            "notes": null,
            "gl_account": "17501: CIP Vendor Key Access",
            "default_qty_type": "MF Unit"
          },
          {
            "name": "Security Cameras",
            "default_cost_per_item": 150.0,
            "notes": null,
            "gl_account": "17595: CIP Security Cameras",
            "default_qty_type": "Building"
          }
        ]
      }
    ]
  },
  {
    "name": "Base Work",
    "sections": [
      {
        "name": "SITE WORK",
        "items": [
          {
            "name": "Grading/Drainage",
            "default_cost_per_item": 50000.0,
            "notes": null,
            "gl_account": "17350: CIP Site Grading/Drainage (15 Yrs)",
            "default_qty_type": "Building"
          },
          {
            "name": "Pads for Dumpsters",
            "default_cost_per_item": 5000.0,
            "notes": null,
            "gl_account": "17570: CIP Trash/Dumpster",
            "default_qty_type": "Each"
          },
          {
            "name": "Retention Wall",
            "default_cost_per_item": 50000.0,
            "notes": null,
            "gl_account": "17300: CIP Retaining Wall (15 Yrs)",
            "default_qty_type": "Each"
          }
        ]
      },
      {
        "name": "FOUNDATION",
        "items": [
          {
            "name": "Piers",
            "default_cost_per_item": 2500.0,
            "notes": null,
            "gl_account": "17445: CIP Foundation (15 Yrs)",
            "default_qty_type": "Each"
          },
          {
            "name": "Add'l Floor Area",
            "default_cost_per_item": 150.0,
            "notes": null,
            "gl_account": "17445: CIP Foundation (15 Yrs)",
            "default_qty_type": "Sqft"
          }
        ]
      },
      {
        "name": "PLUMBING",
        "items": [
          {
            "name": "Gas Service",
            "default_cost_per_item": 150.0,
            "notes": null,
            "gl_account": "17580: CIP Site Gas Service (15 Yrs)",
            "default_qty_type": "Linear Ft"
          },
          {
            "name": "New Water",
            "default_cost_per_item": 50000.0,
            "notes": null,
            "gl_account": "17583: CIP Base - Plumbing - Water",
            "default_qty_type": "Unit"
          },
          {
            "name": "Water Extension",
            "default_cost_per_item": 150.0,
            "notes": null,
            "gl_account": "17583: CIP Base - Plumbing - Water",
            "default_qty_type": "Linear Ft"
          },
          {
            "name": "New Wastewater",
            "default_cost_per_item": 50000.0,
            "notes": null,
            "gl_account": "17585: CIP Sewer Drains/Pipes (15 Yrs)",
            "default_qty_type": "Unit"
          },
          {
            "name": "Wastewater Extension",
            "default_cost_per_item": 150.0,
            "notes": null,
            "gl_account": "17585: CIP Sewer Drains/Pipes (15 Yrs)",
            "default_qty_type": "Linear Ft"
          }
        ]
      },
      {
        "name": "FIRE PROTECTION",
        "items": [
          {
            "name": "Sprinkler - Hookup To Riser",
            "default_cost_per_item": 150.0,
            "notes": null,
            "gl_account": "17917: CIP Base - Fire Protection - Sprinkler",
            "default_qty_type": "Linear Ft"
          },
          {
            "name": "Sprinkler - Utility Hookup",
            "default_cost_per_item": 50000.0,
            "notes": "Tap Plan",
            "gl_account": "17917: CIP Base - Fire Protection - Sprinkler",
            "default_qty_type": "Unit"
          },
          {
            "name": "Sprinkler - Vault Heater",
            "default_cost_per_item": 2500.0,
            "notes": "if needed",
            "gl_account": "17917: CIP Base - Fire Protection - Sprinkler",
            "default_qty_type": "Unit"
          }
        ]
      },
      {
        "name": "ELECTRICAL",
        "items": [
          {
            "name": "Underground Electrical",
            "default_cost_per_item": 150.0,
            "notes": "Street to Transformer (Utility Co)",
            "gl_account": "17371: CIP Base - Electrical",
            "default_qty_type": "Linear Ft"
          },
          {
            "name": "Transformer",
            "default_cost_per_item": 100000.0,
            "notes": null,
            "gl_account": "17371: CIP Base - Electrical",
            "default_qty_type": "Unit"
          },
          {
            "name": "Transformer Pad",
            "default_cost_per_item": 30000.0,
            "notes": "+ Pad & Bollards",
            "gl_account": "17371: CIP Base - Electrical",
            "default_qty_type": "Unit"
          },
          {
            "name": "Meter Bank to Transformer",
            "default_cost_per_item": 150.0,
            "notes": null,
            "gl_account": "17371: CIP Base - Electrical",
            "default_qty_type": "Linear Ft"
          }
        ]
      },
      {
        "name": "PARKING LOT",
        "items": [
          {
            "name": "Overlay - Asphalt",
            "default_cost_per_item": 5.0,
            "notes": null,
            "gl_account": "17535: CIP Parking Lot - Asphalt (15 Yrs)",
            "default_qty_type": "Sqft"
          },
          {
            "name": "Sealcoat",
            "default_cost_per_item": 1.0,
            "notes": null,
            "gl_account": "17540: CIP Parking Lot - Surfacing (15 Yrs)",
            "default_qty_type": "Sqft"
          },
          {
            "name": "Striping",
            "default_cost_per_item": 25.0,
            "notes": null,
            "gl_account": "17530: CIP Parking Lot",
            "default_qty_type": "Park"
          },
          {
            "name": "Curb Stops",
            "default_cost_per_item": 100.0,
            "notes": null,
            "gl_account": "17530: CIP Parking Lot",
            "default_qty_type": "Park"
          },
          {
            "name": "Speed Bumps",
            "default_cost_per_item": 1500.0,
            "notes": null,
            "gl_account": "17530: CIP Parking Lot",
            "default_qty_type": "Unit"
          },
          {
            "name": "Bike Racks",
            "default_cost_per_item": 5000.0,
            "notes": null,
            "gl_account": "17530: CIP Parking Lot",
            "default_qty_type": "Unit"
          }
        ]
      }
    ]
  },
  {
    "name": "Building Work",
    "sections": [
      {
        "name": "ELECTRICAL",
        "items": [
          {
            "name": "New Meter Banks",
            "default_cost_per_item": 10000.0,
            "notes": null,
            "gl_account": "17370: CIP Building - Electrical Submetering (15 Yrs)",
            "default_qty_type": "Unit"
          },
          {
            "name": "Electric Submeters Materials",
            "default_cost_per_item": 100.0,
            "notes": "owned by Utility Co",
            "gl_account": "17370: CIP Building - Electrical Submetering (15 Yrs)",
            "default_qty_type": "MF Unit"
          },
          {
            "name": "Electric Submeters Labor",
            "default_cost_per_item": 100.0,
            "notes": "done by Utility Co",
            "gl_account": "17370: CIP Building - Electrical Submetering (15 Yrs)",
            "default_qty_type": "MF Unit"
          }
        ]
      },
      {
        "name": "FIRE PROTECTION",
        "items": [
          {
            "name": "Fire Alarm Control Panel",
            "default_cost_per_item": null,
            "notes": null,
            "gl_account": "17366: CIP Building - Fire Protection - Alarm System",
            "default_qty_type": "Device",
            "options": [
              {
                "finish": "High-Rise",
                "default_cost": 35000.0
              },
              {
                "finish": "Garden Style",
                "default_cost": 35000.0
              },
              {
                "finish": "Single Building",
                "default_cost": 25000.0
              }
            ]
          },
          {
            "name": "Sprinkler - Riser Room  Setup",
            "default_cost_per_item": 25000.0,
            "notes": null,
            "gl_account": "17365: CIP Building - Fire Protection - Sprinklers",
            "default_qty_type": "Unit"
          },
          {
            "name": "Sprinkler - Heater",
            "default_cost_per_item": 2500.0,
            "notes": null,
            "gl_account": "17365: CIP Building - Fire Protection - Sprinklers",
            "default_qty_type": "Unit"
          },
          {
            "name": "Sprinkler - Building Lines",
            "default_cost_per_item": 3.0,
            "notes": null,
            "gl_account": "17365: CIP Building - Fire Protection - Sprinklers",
            "default_qty_type": "Sqft"
          },
          {
            "name": "Sprinkler - Fire Assembly",
            "default_cost_per_item": 500.0,
            "notes": null,
            "gl_account": "17365: CIP Building - Fire Protection - Sprinklers",
            "default_qty_type": "MF Unit"
          }
        ]
      },
      {
        "name": "PLUMBING",
        "items": [
          {
            "name": "Water Heater",
            "default_cost_per_item": null,
            "notes": null,
            "gl_account": "17587: CIP Building - Plumbing",
            "default_qty_type": "Device",
            "options": [
              {
                "finish": "Gas",
                "default_cost": 12000.0
              },
              {
                "finish": "Electric",
                "default_cost": 25000.0
              }
            ]
          },
          {
            "name": "Boiler Replacement",
            "default_cost_per_item": 25000.0,
            "notes": null,
            "gl_account": "17587: CIP Building - Plumbing",
            "default_qty_type": "Device"
          },
          {
            "name": "Shutoff Valves",
            "default_cost_per_item": null,
            "notes": null,
            "gl_account": "17587: CIP Building - Plumbing",
            "default_qty_type": "MF Unit",
            "options": [
              {
                "finish": "New",
                "default_cost": 350.0
              },
              {
                "finish": "Shift Location",
                "default_cost": 250.0
              }
            ]
          }
        ]
      },
      {
        "name": "FRAMING",
        "items": [
          {
            "name": "Attic Walkway",
            "default_cost_per_item": 5000.0,
            "notes": "Pitched Roof Only",
            "gl_account": "17390: CIP Building - Framing",
            "default_qty_type": "Building"
          },
          {
            "name": "Demise Add'l Units",
            "default_cost_per_item": 5000.0,
            "notes": null,
            "gl_account": "17390: CIP Building - Framing",
            "default_qty_type": "Unit"
          }
        ]
      },
      {
        "name": "INTERIOR CORRIDORS",
        "items": [
          {
            "name": "Hallways Reno (non-floors)",
            "default_cost_per_item": 5000.0,
            "notes": "Carpet, Paint, Fixtures, Doors",
            "gl_account": "17800: CIP Common Hallways & Stairwells",
            "default_qty_type": "Int. Hall"
          },
          {
            "name": "Hallway Floors",
            "default_cost_per_item": null,
            "notes": null,
            "gl_account": "17800: CIP Common Hallways & Stairwells",
            "default_qty_type": "Sqft",
            "options": [
              {
                "finish": "Vinyl Plank",
                "default_cost": 1.5
              },
              {
                "finish": "Carpet",
                "default_cost": 4.0
              },
              {
                "finish": "Polished Concrete",
                "default_cost": 1.0
              }
            ]
          },
          {
            "name": "Hallways Art",
            "default_cost_per_item": null,
            "notes": null,
            "gl_account": "17800: CIP Common Hallways & Stairwells",
            "default_qty_type": "Int. Hall",
            "options": [
              {
                "finish": "High",
                "default_cost": 10000.0
              },
              {
                "finish": "Medium",
                "default_cost": 5000.0
              },
              {
                "finish": "Low",
                "default_cost": 2500.0
              }
            ]
          }
        ]
      }
    ]
  },
  {
    "name": "Interior",
    "sections": [
      {
        "name": "General",
        "items": [
          {
            "name": "MATERIALS IMPORT TAX",
            "default_cost_per_item": 20.0,
            "notes": null,
            "gl_account": "17230: CIP Interior - Freight/Overseas Shipping",
            "default_qty_type": "%"
          },
          {
            "name": "DEMO LABOR",
            "default_cost_per_item": 250.0,
            "notes": null,
            "gl_account": "17101: CIP Interior - Renovation Labor",
            "default_qty_type": "Reno Unit"
          }
        ]
      },
      {
        "name": "MECHANICAL ROUGH-INS",
        "items": [
          {
            "name": "PTAC Units",
            "default_cost_per_item": 1500.0,
            "notes": "Heat pump Units",
            "gl_account": "17151: CIP Interior - Mechanical Rough-In",
            "default_qty_type": "Reno Unit"
          },
          {
            "name": "Exhaust Fans & Ducts",
            "default_cost_per_item": null,
            "notes": "(1/BA, 1-Kithchen)",
            "gl_account": "17151: CIP Interior - Mechanical Rough-In",
            "default_qty_type": "Reno Unit",
            "options": [
              {
                "finish": "Recir. Vent Hood",
                "default_cost": 150.0
              },
              {
                "finish": "To Exterior",
                "default_cost": 1500.0
              }
            ]
          },
          {
            "name": "HVAC Units",
            "default_cost_per_item": 2500.0,
            "notes": "# of Ground Floor Units",
            "gl_account": "17151: CIP Interior - Mechanical Rough-In",
            "default_qty_type": "Reno Unit"
          },
          {
            "name": "Mech. Rough-In Labor",
            "default_cost_per_item": 500.0,
            "notes": null,
            "gl_account": "17151: CIP Interior - Mechanical Rough-In",
            "default_qty_type": "Reno Unit"
          },
          {
            "name": "Mech. Rough-In Materials",
            "default_cost_per_item": 500.0,
            "notes": null,
            "gl_account": "17151: CIP Interior - Mechanical Rough-In",
            "default_qty_type": "Reno Unit"
          }
        ]
      },
      {
        "name": "ELECTRICAL ROUGH-INS",
        "items": [
          {
            "name": "Electrical Rough-in Materials",
            "default_cost_per_item": null,
            "notes": "includes add'l outlets",
            "gl_account": "17202: CIP Interior - Electrical Rough-In",
            "default_qty_type": "Reno Unit",
            "options": [
              {
                "finish": "Rewire Existing",
                "default_cost": 250.0
              },
              {
                "finish": "New Circuits",
                "default_cost": 1000.0
              }
            ]
          },
          {
            "name": "Electrical Rough-in Labor",
            "default_cost_per_item": null,
            "notes": null,
            "gl_account": "17202: CIP Interior - Electrical Rough-In",
            "default_qty_type": "Reno Unit",
            "options": [
              {
                "finish": "Rewire Existing",
                "default_cost": 500.0
              },
              {
                "finish": "New Circuits",
                "default_cost": 500.0
              }
            ]
          },
          {
            "name": "Electrical Framing",
            "default_cost_per_item": 250.0,
            "notes": null,
            "gl_account": "17202: CIP Interior - Electrical Rough-In",
            "default_qty_type": "Reno Unit"
          }
        ]
      },
      {
        "name": "PLUMBING ROUGH-INS",
        "items": [
          {
            "name": "Plumbing Rough-In Materials",
            "default_cost_per_item": 250.0,
            "notes": "piping, valves",
            "gl_account": "17133: CIP Interior - Plumbing Rough-In",
            "default_qty_type": "Reno Unit"
          },
          {
            "name": "Plumbing Rough-In Labor",
            "default_cost_per_item": 500.0,
            "notes": null,
            "gl_account": "17133: CIP Interior - Plumbing Rough-In",
            "default_qty_type": "Reno Unit"
          },
          {
            "name": "HVAC Condensate Lines",
            "default_cost_per_item": 500.0,
            "notes": "Upper Floor Units (not ground #)",
            "gl_account": "17133: CIP Interior - Plumbing Rough-In",
            "default_qty_type": "Reno Unit"
          }
        ]
      },
      {
        "name": "DRYWALL",
        "items": [
          {
            "name": "Materials",
            "default_cost_per_item": 1.53,
            "notes": null,
            "gl_account": "17190: CIP Interior - Drywall",
            "default_qty_type": "Sqft"
          },
          {
            "name": "Labor",
            "default_cost_per_item": 1.53,
            "notes": null,
            "gl_account": "17190: CIP Interior - Drywall",
            "default_qty_type": "Sqft"
          }
        ]
      },
      {
        "name": "INTERIOR RENOVATION",
        "items": [
          {
            "name": "Flooring Materials",
            "default_cost_per_item": null,
            "notes": null,
            "gl_account": "17110: CIP Interior - Flooring Vinyl (5 Yrs)",
            "default_qty_type": "Avg Sqft",
            "options": [
              {
                "finish": "Hardwood",
                "default_cost": 5.0
              },
              {
                "finish": "Vinyl Plank",
                "default_cost": 1.5
              },
              {
                "finish": "Polished Concrete",
                "default_cost": 0.5
              }
            ]
          },
          {
            "name": "Flooring Leveller",
            "default_cost_per_item": 200.0,
            "notes": null,
            "gl_account": "17112: CIP Interior - Floor Leveller",
            "default_qty_type": "Reno Unit"
          },
          {
            "name": "Smoke & CO2 Alarms",
            "default_cost_per_item": 25.0,
            "notes": null,
            "gl_account": "17177: CIP Interior - Smoke/CO2 Alarms Fixtures (5 Yrs)",
            "default_qty_type": "Avg # BRs"
          },
          {
            "name": "Lighting Fixtures",
            "default_cost_per_item": null,
            "notes": null,
            "gl_account": "17175: CIP Interior - Lighting Fixtures (7 Yrs)",
            "default_qty_type": "Avg # BRs",
            "options": [
              {
                "finish": "Brushed Nickel",
                "default_cost": 40.0
              },
              {
                "finish": "Plastic",
                "default_cost": 20.0
              }
            ]
          },
          {
            "name": "Bathroom Mirrors",
            "default_cost_per_item": 200.0,
            "notes": null,
            "gl_account": "17205: CIP Interior - Bathroom Mirrors (5 Yrs)",
            "default_qty_type": "Avg # BAs"
          },
          {
            "name": "Tub Surround",
            "default_cost_per_item": null,
            "notes": null,
            "gl_account": "17180: CIP Interior - Tubs/Shower Surround",
            "default_qty_type": "Avg # BAs",
            "options": [
              {
                "finish": "Panels",
                "default_cost": 250.0
              },
              {
                "finish": "Tiles",
                "default_cost": 750.0
              }
            ]
          },
          {
            "name": "Appliances",
            "default_cost_per_item": null,
            "notes": null,
            "gl_account": "17125: CIP Interior - Appliances (5 Yrs)",
            "default_qty_type": "Reno Unit",
            "options": [
              {
                "finish": "White",
                "default_cost": 650.0
              },
              {
                "finish": "Black",
                "default_cost": 1000.0
              },
              {
                "finish": "Stainless Steel",
                "default_cost": 1500.0
              }
            ]
          },
          {
            "name": "Plumbing Fixtures",
            "default_cost_per_item": null,
            "notes": null,
            "gl_account": "17130: CIP Interior - Plumbing Fixtures (7 Yrs)",
            "default_qty_type": "Avg # BAs",
            "options": [
              {
                "finish": "Brushed Nickel",
                "default_cost": 40.0
              },
              {
                "finish": "Plastic",
                "default_cost": 20.0
              }
            ]
          },
          {
            "name": "Kitchen Countertop",
            "default_cost_per_item": null,
            "notes": null,
            "gl_account": "17135: CIP Interior - Countertops (5 Yrs)",
            "default_qty_type": "Reno Unit",
            "options": [
              {
                "finish": "Granite",
                "default_cost": 500.0
              },
              {
                "finish": "Resurfaced",
                "default_cost": 150.0
              }
            ]
          },
          {
            "name": "Kitchen Backsplash",
            "default_cost_per_item": 500.0,
            "notes": null,
            "gl_account": "17140: CIP Interior - Backsplash (7 Yrs)",
            "default_qty_type": "Reno Unit"
          },
          {
            "name": "Cabinets",
            "default_cost_per_item": 1200.0,
            "notes": "cabinets OR cab door/pulls",
            "gl_account": "17145: CIP Interior - Cabinetry (5 Yrs)",
            "default_qty_type": "Reno Unit"
          },
          {
            "name": "Cab Door + Pulls",
            "default_cost_per_item": 300.0,
            "notes": null,
            "gl_account": "17145: CIP Interior - Cabinetry (5 Yrs)",
            "default_qty_type": "Reno Unit"
          },
          {
            "name": "Door Hardware",
            "default_cost_per_item": null,
            "notes": null,
            "gl_account": "17170: CIP Interior - Doors & Hardware",
            "default_qty_type": "Avg # BRs",
            "options": [
              {
                "finish": "Brushed Nickel",
                "default_cost": 25.0
              },
              {
                "finish": "Plastic",
                "default_cost": 10.0
              }
            ]
          },
          {
            "name": "Trim & Molding",
            "default_cost_per_item": 500.0,
            "notes": null,
            "gl_account": "17225: CIP Interior - Trim & Molding",
            "default_qty_type": "Reno Unit"
          },
          {
            "name": "Door Repairs",
            "default_cost_per_item": 15.0,
            "notes": null,
            "gl_account": "17170: CIP Interior - Doors & Hardware",
            "default_qty_type": "Avg # BRs"
          },
          {
            "name": "Blinds",
            "default_cost_per_item": 50.0,
            "notes": null,
            "gl_account": "17122: CIP Interior - Blinds (5 Yrs)",
            "default_qty_type": "Avg # BRs"
          },
          {
            "name": "Paint",
            "default_cost_per_item": 0.5,
            "notes": null,
            "gl_account": "17160: CIP Interior - Paint",
            "default_qty_type": "Avg Sqft"
          },
          {
            "name": "MISC Materials",
            "default_cost_per_item": 100.0,
            "notes": null,
            "gl_account": "17220: CIP Interior - General Building Materials",
            "default_qty_type": "Reno Unit"
          },
          {
            "name": "Down Units",
            "default_cost_per_item": 2000.0,
            "notes": null,
            "gl_account": "17220: CIP Interior - General Building Materials",
            "default_qty_type": "Reno Unit"
          },
          {
            "name": "Renovation Labor",
            "default_cost_per_item": 6.5,
            "notes": null,
            "gl_account": "17101: CIP Interior - Renovation Labor",
            "default_qty_type": "Avg Sqft"
          }
        ]
      }
    ]
  },
  {
    "name": "Exterior",
    "sections": [
      {
        "name": "General",
        "items": [
          {
            "name": "DUMPSTERS",
            "default_cost_per_item": 500.0,
            "notes": null,
            "gl_account": "17570: CIP Trash/Dumpster",
            "default_qty_type": "Cubic Yard"
          },
          {
            "name": "STAIRWAYS",
            "default_cost_per_item": 25.0,
            "notes": "Riser Fill In",
            "gl_account": "17330: CIP Exterior Stairs",
            "default_qty_type": "Sqft"
          },
          {
            "name": "SECURITY CAMERAS",
            "default_cost_per_item": 100.0,
            "notes": "Permanent (leasing, storage, parking)",
            "gl_account": "17595: CIP Security Cameras",
            "default_qty_type": "Device"
          },
          {
            "name": "EXTERIOR DOORS",
            "default_cost_per_item": 1000.0,
            "notes": "for replacement",
            "gl_account": "17396: CIP Exterior - Common Doors",
            "default_qty_type": "Unit"
          }
        ]
      },
      {
        "name": "GATE/FENCE REPAIRS",
        "items": [
          {
            "name": "Dumpster Corrals",
            "default_cost_per_item": 2500.0,
            "notes": null,
            "gl_account": "17435: CIP Fence/Gate (15 Yrs)",
            "default_qty_type": "Unit"
          },
          {
            "name": "New Fence",
            "default_cost_per_item": 2.5,
            "notes": null,
            "gl_account": "17435: CIP Fence/Gate (15 Yrs)",
            "default_qty_type": "Linear Ft"
          },
          {
            "name": "Access Gate",
            "default_cost_per_item": 5000.0,
            "notes": "Security",
            "gl_account": "17435: CIP Fence/Gate (15 Yrs)",
            "default_qty_type": "Device"
          },
          {
            "name": "Repair Fence",
            "default_cost_per_item": 1.0,
            "notes": null,
            "gl_account": "17435: CIP Fence/Gate (15 Yrs)",
            "default_qty_type": "Linear Ft"
          }
        ]
      },
      {
        "name": "SIGNAGE",
        "items": [
          {
            "name": "Unit Number Signage",
            "default_cost_per_item": 50.0,
            "notes": null,
            "gl_account": "17560: CIP Signage (5 Yrs)",
            "default_qty_type": "Unit"
          },
          {
            "name": "Pilon Sign (Face)",
            "default_cost_per_item": 10000.0,
            "notes": null,
            "gl_account": "17560: CIP Signage (5 Yrs)",
            "default_qty_type": "Each"
          },
          {
            "name": "Monument Sign (Face)",
            "default_cost_per_item": 15000.0,
            "notes": null,
            "gl_account": "17560: CIP Signage (5 Yrs)",
            "default_qty_type": "Each"
          },
          {
            "name": "Wayfinding Signs",
            "default_cost_per_item": 1500.0,
            "notes": "General signs, not per unit",
            "gl_account": "17560: CIP Signage (5 Yrs)",
            "default_qty_type": "Building"
          },
          {
            "name": "Leasing Office Sign",
            "default_cost_per_item": 5000.0,
            "notes": "incl parking signs",
            "gl_account": "17560: CIP Signage (5 Yrs)",
            "default_qty_type": "Each"
          },
          {
            "name": "Building Signage",
            "default_cost_per_item": 5000.0,
            "notes": null,
            "gl_account": "17560: CIP Signage (5 Yrs)",
            "default_qty_type": "Building"
          }
        ]
      },
      {
        "name": "PER UNIT EXTERIOR",
        "items": [
          {
            "name": "Exterior Lighting (/Unit)",
            "default_cost_per_item": 100.0,
            "notes": null,
            "gl_account": "17480: CIP Exterior - Lighting Per Unit  (5 Yrs)",
            "default_qty_type": "Unit"
          },
          {
            "name": "Unit Door",
            "default_cost_per_item": 250.0,
            "notes": null,
            "gl_account": "17395: CIP Exterior - Doors Per Unit",
            "default_qty_type": "Unit"
          },
          {
            "name": "Solar Screen",
            "default_cost_per_item": 50.0,
            "notes": null,
            "gl_account": "17410: CIP Solar Screens",
            "default_qty_type": "Avg # BRs"
          },
          {
            "name": "Windows",
            "default_cost_per_item": 150.0,
            "notes": null,
            "gl_account": "17425: CIP Exterior - Windows",
            "default_qty_type": "Avg # BRs"
          },
          {
            "name": "Fences/Yards",
            "default_cost_per_item": 1500.0,
            "notes": null,
            "gl_account": "17435: CIP Fence/Gate (15 Yrs)",
            "default_qty_type": "Each"
          }
        ]
      },
      {
        "name": "ELECTRICAL - EXTERIOR",
        "items": [
          {
            "name": "Egress Lighting",
            "default_cost_per_item": 2500.0,
            "notes": null,
            "gl_account": "17499: CIP Exterior - Lighting",
            "default_qty_type": "Building"
          },
          {
            "name": "Exit Signs",
            "default_cost_per_item": 500.0,
            "notes": null,
            "gl_account": "17499: CIP Exterior - Lighting",
            "default_qty_type": "Building"
          },
          {
            "name": "Exteriors Flood Lights",
            "default_cost_per_item": 1500.0,
            "notes": null,
            "gl_account": "17499: CIP Exterior - Lighting",
            "default_qty_type": "Building"
          },
          {
            "name": "Electrical for Exterior Items",
            "default_cost_per_item": 1500.0,
            "notes": null,
            "gl_account": "17375: CIP Electrical Exterior (15 Yrs)",
            "default_qty_type": "Building"
          }
        ]
      },
      {
        "name": "ROOF",
        "items": [
          {
            "name": "Roof Repairs",
            "default_cost_per_item": 10.0,
            "notes": null,
            "gl_account": "17550: CIP Roofing",
            "default_qty_type": "Sqft"
          },
          {
            "name": "Gutters & Downspouts",
            "default_cost_per_item": 5000.0,
            "notes": null,
            "gl_account": "17550: CIP Roofing",
            "default_qty_type": "Building"
          }
        ]
      },
      {
        "name": "RAILINGS",
        "items": [
          {
            "name": "Railings",
            "default_cost_per_item": 1.5,
            "notes": "Repair/Replace",
            "gl_account": "17325: CIP Exterior - Railings",
            "default_qty_type": "Linear Ft"
          },
          {
            "name": "Sandblasting",
            "default_cost_per_item": 1.0,
            "notes": null,
            "gl_account": "17325: CIP Exterior - Railings",
            "default_qty_type": "Sqft"
          },
          {
            "name": "Panels - Material",
            "default_cost_per_item": 5.0,
            "notes": null,
            "gl_account": "17325: CIP Exterior - Railings",
            "default_qty_type": "Sqft"
          },
          {
            "name": "Welder - Labor",
            "default_cost_per_item": 5.0,
            "notes": null,
            "gl_account": "17325: CIP Exterior - Railings",
            "default_qty_type": "Linear Ft"
          }
        ]
      },
      {
        "name": "WALKWAYS",
        "items": [
          {
            "name": "New Framing - Materials",
            "default_cost_per_item": 25.0,
            "notes": null,
            "gl_account": "17335: CIP Exterior Walkways",
            "default_qty_type": "Sqft"
          },
          {
            "name": "New Framing - Labor",
            "default_cost_per_item": 25.0,
            "notes": null,
            "gl_account": "17335: CIP Exterior Walkways",
            "default_qty_type": "Sqft"
          },
          {
            "name": "Concrete Walks - Finish Coat",
            "default_cost_per_item": 10.0,
            "notes": null,
            "gl_account": "17335: CIP Exterior Walkways",
            "default_qty_type": "Sqft"
          },
          {
            "name": "Welder",
            "default_cost_per_item": 5.0,
            "notes": null,
            "gl_account": "17335: CIP Exterior Walkways",
            "default_qty_type": "Sqft"
          },
          {
            "name": "Walkway Extension",
            "default_cost_per_item": 15.0,
            "notes": null,
            "gl_account": "17335: CIP Exterior Walkways",
            "default_qty_type": "Sqft"
          }
        ]
      },
      {
        "name": "SIDING",
        "items": [
          {
            "name": "Sandblasting",
            "default_cost_per_item": 2.5,
            "notes": "Materials & Install",
            "gl_account": "17415: CIP Siding",
            "default_qty_type": "Sqft"
          },
          {
            "name": "Exterior Paint",
            "default_cost_per_item": 5.0,
            "notes": "Materials & Install",
            "gl_account": "17515: CIP Exterior Paint",
            "default_qty_type": "Sqft"
          },
          {
            "name": "Siding",
            "default_cost_per_item": 10.0,
            "notes": "Materials & Install (w/ Paint)",
            "gl_account": "17420: CIP Siding (Vinyl) (5 Yrs)",
            "default_qty_type": "Sqft"
          },
          {
            "name": "Stucco",
            "default_cost_per_item": 15.0,
            "notes": null,
            "gl_account": "17423: CIP Exterior - Siding (Stucco)",
            "default_qty_type": "Sqft"
          }
        ]
      },
      {
        "name": "DESIGN ELEMENT",
        "items": [
          {
            "name": "Metal Panels",
            "default_cost_per_item": 2500.0,
            "notes": "Materials & Install",
            "gl_account": "17400: CIP Fa\u00e7ade",
            "default_qty_type": "Each"
          },
          {
            "name": "Porte Cochere",
            "default_cost_per_item": 25000.0,
            "notes": null,
            "gl_account": "17400: CIP Fa\u00e7ade",
            "default_qty_type": "Each"
          },
          {
            "name": "Store Front",
            "default_cost_per_item": 10000.0,
            "notes": null,
            "gl_account": "17403: CIP Exterior - Store Front - Curtain Walls",
            "default_qty_type": "Each"
          }
        ]
      },
      {
        "name": "LANDSCAPING",
        "items": [
          {
            "name": "Planters, Welder, Hedge",
            "default_cost_per_item": 25000.0,
            "notes": null,
            "gl_account": "17470: CIP Landscaping",
            "default_qty_type": "Sqft"
          },
          {
            "name": "Front Curb Appeal",
            "default_cost_per_item": 1000.0,
            "notes": null,
            "gl_account": "17470: CIP Landscaping",
            "default_qty_type": "Linear Ft"
          },
          {
            "name": "Irrigation",
            "default_cost_per_item": 10.0,
            "notes": null,
            "gl_account": "17470: CIP Landscaping",
            "default_qty_type": "Sqft"
          }
        ]
      }
    ]
  },
  {
    "name": "Amenities",
    "sections": [
      {
        "name": "General",
        "items": [
          {
            "name": "LAUNDRY ROOM Build",
            "default_cost_per_item": 25000.0,
            "notes": null,
            "gl_account": "17830: CIP Laundry Room",
            "default_qty_type": "Each"
          },
          {
            "name": "LAUNDRY Machines",
            "default_cost_per_item": 500.0,
            "notes": null,
            "gl_account": "17830: CIP Laundry Room",
            "default_qty_type": "Each"
          },
          {
            "name": "COMMON BATHROOMS",
            "default_cost_per_item": 10000.0,
            "notes": null,
            "gl_account": "17690: CIP Common - Common Bathrooms",
            "default_qty_type": "Each"
          },
          {
            "name": "DOG PARK BUILD",
            "default_cost_per_item": 15000.0,
            "notes": null,
            "gl_account": "17620: CIP Dog Park (15 Yrs)",
            "default_qty_type": "Each"
          },
          {
            "name": "DOG PARK EQUIPMENT",
            "default_cost_per_item": 25000.0,
            "notes": null,
            "gl_account": "17620: CIP Dog Park (15 Yrs)",
            "default_qty_type": "Each"
          },
          {
            "name": "FIRE PIT",
            "default_cost_per_item": 15000.0,
            "notes": null,
            "gl_account": "17615: CIP Fire Pit/BBQ",
            "default_qty_type": "Each"
          },
          {
            "name": "SPORT COURT",
            "default_cost_per_item": 50000.0,
            "notes": null,
            "gl_account": "17650: CIP Playground (15 Yrs)",
            "default_qty_type": "Each"
          },
          {
            "name": "PLAYGROUND",
            "default_cost_per_item": 25000.0,
            "notes": null,
            "gl_account": "17650: CIP Playground (15 Yrs)",
            "default_qty_type": "Each"
          },
          {
            "name": "OUTDOOR KITCHEN",
            "default_cost_per_item": 30000.0,
            "notes": null,
            "gl_account": "17660: CIP Pool - Grill/Kitchen (5 Yrs)",
            "default_qty_type": "Each"
          }
        ]
      },
      {
        "name": "GYM",
        "items": [
          {
            "name": "GYM Build",
            "default_cost_per_item": 30000.0,
            "notes": null,
            "gl_account": "17630: CIP Fitness Center Build Out",
            "default_qty_type": "Each"
          },
          {
            "name": "GYM Equipment",
            "default_cost_per_item": 30000.0,
            "notes": null,
            "gl_account": "17625: CIP Fitness Center - Equipment (7 Yrs)",
            "default_qty_type": "Each"
          }
        ]
      },
      {
        "name": "OTHER AMENITIES",
        "items": [
          {
            "name": "Theater",
            "default_cost_per_item": 30000.0,
            "notes": null,
            "gl_account": "17642: CIP Common - Common Amenities Other",
            "default_qty_type": "Each"
          },
          {
            "name": "Karaoke",
            "default_cost_per_item": 30000.0,
            "notes": null,
            "gl_account": "17642: CIP Common - Common Amenities Other",
            "default_qty_type": "Each"
          },
          {
            "name": "Game Room",
            "default_cost_per_item": 30000.0,
            "notes": null,
            "gl_account": "17642: CIP Common - Common Amenities Other",
            "default_qty_type": "Each"
          }
        ]
      },
      {
        "name": "ELEVATOR",
        "items": [
          {
            "name": "Demo",
            "default_cost_per_item": 10000.0,
            "notes": null,
            "gl_account": "17385: CIP Elevator",
            "default_qty_type": "Each"
          },
          {
            "name": "Hoistway",
            "default_cost_per_item": 15000.0,
            "notes": null,
            "gl_account": "17385: CIP Elevator",
            "default_qty_type": "Each"
          },
          {
            "name": "Cab",
            "default_cost_per_item": 25000.0,
            "notes": null,
            "gl_account": "17385: CIP Elevator",
            "default_qty_type": "Each"
          },
          {
            "name": "Machinery",
            "default_cost_per_item": 25000.0,
            "notes": null,
            "gl_account": "17385: CIP Elevator",
            "default_qty_type": "Each"
          },
          {
            "name": "Sump Pump",
            "default_cost_per_item": 10000.0,
            "notes": null,
            "gl_account": "17385: CIP Elevator",
            "default_qty_type": "Each"
          }
        ]
      },
      {
        "name": "POOL",
        "items": [
          {
            "name": "Dig & Insert Pool",
            "default_cost_per_item": 100000.0,
            "notes": null,
            "gl_account": "17681 - CIP Pool",
            "default_qty_type": "Each"
          },
          {
            "name": "Pool Machinery",
            "default_cost_per_item": 35000.0,
            "notes": null,
            "gl_account": "17675: CIP Pool - Machinery",
            "default_qty_type": "Each"
          },
          {
            "name": "Pool Decking",
            "default_cost_per_item": 50.0,
            "notes": null,
            "gl_account": "17657: CIP Common - Pool Decking",
            "default_qty_type": "Sqft"
          },
          {
            "name": "Coping Tile",
            "default_cost_per_item": 50.0,
            "notes": null,
            "gl_account": "17670: CIP Pool - Surface & Shell",
            "default_qty_type": "Sqft"
          },
          {
            "name": "Furniture",
            "default_cost_per_item": 35000.0,
            "notes": null,
            "gl_account": "17655: CIP Pool - Furniture (7 Yrs)",
            "default_qty_type": "Each"
          }
        ]
      },
      {
        "name": "CLUBHOUSE/LOBBY",
        "items": [
          {
            "name": "Clubhouse Demo",
            "default_cost_per_item": 10000.0,
            "notes": null,
            "gl_account": "17635: CIP Leasing Center Build Out",
            "default_qty_type": "Each"
          },
          {
            "name": "Framing",
            "default_cost_per_item": 25000.0,
            "notes": "Materials & Labor",
            "gl_account": "17635: CIP Leasing Center Build Out",
            "default_qty_type": "Each"
          },
          {
            "name": "Mechanical",
            "default_cost_per_item": 15000.0,
            "notes": "Materials & Labor",
            "gl_account": "17635: CIP Leasing Center Build Out",
            "default_qty_type": "Each"
          },
          {
            "name": "Electrical",
            "default_cost_per_item": 15000.0,
            "notes": "Materials & Labor",
            "gl_account": "17635: CIP Leasing Center Build Out",
            "default_qty_type": "Each"
          },
          {
            "name": "Plumbing",
            "default_cost_per_item": 15000.0,
            "notes": "Materials & Labor",
            "gl_account": "17635: CIP Leasing Center Build Out",
            "default_qty_type": "Each"
          },
          {
            "name": "Drywall",
            "default_cost_per_item": 15000.0,
            "notes": "Materials & Labor",
            "gl_account": "17635: CIP Leasing Center Build Out",
            "default_qty_type": "Each"
          },
          {
            "name": "Finishes",
            "default_cost_per_item": 25000.0,
            "notes": "Materials & Labor",
            "gl_account": "17635: CIP Leasing Center Build Out",
            "default_qty_type": "Each"
          },
          {
            "name": "Interior Designer - FF&E",
            "default_cost_per_item": 25000.0,
            "notes": null,
            "gl_account": "17805: CIP Common Area FF&E",
            "default_qty_type": "Each"
          },
          {
            "name": "Sound System",
            "default_cost_per_item": 10000.0,
            "notes": null,
            "gl_account": "17645: CIP Clubhouse - Sound System (5 Yrs)",
            "default_qty_type": "Each"
          },
          {
            "name": "Tech Equipment",
            "default_cost_per_item": 5000.0,
            "notes": null,
            "gl_account": "17955: CIP Office/Computer Equipment (5 Yrs)",
            "default_qty_type": "Each"
          },
          {
            "name": "Business Center",
            "default_cost_per_item": 10000.0,
            "notes": null,
            "gl_account": "17955: CIP Office/Computer Equipment (5 Yrs)",
            "default_qty_type": "Each"
          }
        ]
      },
      {
        "name": "MAIL CENTER",
        "items": [
          {
            "name": "Mailboxes",
            "default_cost_per_item": 50.0,
            "notes": null,
            "gl_account": "17505: CIP Mailbox",
            "default_qty_type": "Unit"
          },
          {
            "name": "Package Boxes",
            "default_cost_per_item": 100.0,
            "notes": null,
            "gl_account": "17505: CIP Mailbox",
            "default_qty_type": "Building"
          }
        ]
      }
    ]
  },
  {
    "name": "Commercial Tenant Costs",
    "sections": []
  }
]
};
window.SURVEY_EXTRACTION_PROMPT = "You are a real estate survey analyst. Extract physical site specs from the survey PDF and return a JSON object. Return ONLY the raw JSON \u2014 no markdown fences, no explanation.\n\nJSON schema:\n{\n  \"flat\": {\n    \"parking_regular\": number|null,\n    \"parking_spots_hc\": number|null,\n    \"parking_spots_existing\": number|null,\n    \"land_sf\": number|null,\n    \"land_acres\": number|null,\n    \"site_perimeter_lf\": number|null,\n    \"fencing_notes\": \"string or n/a\",\n    \"gates_notes\": \"string or n/a\",\n    \"parking_lot_sf\": number|null,\n    \"num_buildings\": number|null,\n    \"total_footprint_sf\": number|null,\n    \"total_roof_sf\": number|null,\n    \"total_facade_sf\": number|null,\n    \"landscaping_sf\": number|null\n  },\n  \"buildings\": [\n    {\n      \"label\": \"string\",\n      \"footprint_sf\": number|null,\n      \"stories\": number|null,\n      \"height_ft\": number|null,\n      \"roof_pitch\": \"e.g. 4:12 or flat\",\n      \"roof_sf\": number|null,\n      \"facade_sf\": number|null\n    }\n  ],\n  \"meta\": {\n    \"property_name\": \"string\",\n    \"survey_date\": \"YYYY-MM-DD\",\n    \"address\": \"string\",\n    \"scale_paper\": \"e.g. 1 inch = 30 feet\",\n    \"ft_per_pixel\": number|null\n  },\n  \"notes\": \"any cross-reference notes as a single string\",\n  \"discrepancies\": [\"array of discrepancy strings\"]\n}\n\nRules:\n- Use null (not 0, not empty string) for any value you cannot determine.\n- fencing_notes / gates_notes: use \"n/a\" if the survey shows none.\n- parking_spots_existing = regular + HC total.\n- total_footprint_sf = sum of all buildings footprint_sf.\n- total_roof_sf = sum of all buildings roof_sf.\n- total_facade_sf = sum of all buildings facade_sf.\n- landscaping_sf \u2248 land_sf \u2212 total_footprint_sf \u2212 parking_lot_sf.\n- roof_sf per building = footprint_sf multiplied by pitch factor: flat=1.02, 3:12=1.031, 4:12=1.054, 5:12=1.083, 6:12=1.118, 8:12=1.202.\n- List each building separately in the buildings array.\n- Extract the graphic scale bar or stated paper scale to populate meta fields.";
