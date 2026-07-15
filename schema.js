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
        "required": true,
        "maxlength": 25
      },
      {
        "key": "mailing_address",
        "label": "Mailing Address",
        "type": "text",
        "required": true
      },
      {
        "key": "city",
        "label": "City",
        "type": "text",
        "row": "id_loc"
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
        ],
        "required": true,
        "row": "id_loc"
      },
      {
        "key": "zip",
        "label": "ZIP",
        "type": "text",
        "pattern": "[0-9]{5}",
        "row": "id_loc"
      },
      {
        "key": "market_msa",
        "label": "Market (MSA)",
        "type": "select",
        "options": [
          "New York, NY",
          "Los Angeles, CA",
          "Chicago, IL",
          "Dallas, TX",
          "Houston, TX",
          "Atlanta, GA",
          "Washington, DC",
          "Miami, FL",
          "Philadelphia, PA",
          "Phoenix, AZ",
          "Boston, MA",
          "Riverside, CA",
          "San Francisco, CA",
          "Detroit, MI",
          "Seattle, WA",
          "Minneapolis, MN",
          "Tampa, FL",
          "San Diego, CA",
          "Denver, CO",
          "Orlando, FL",
          "Charlotte, NC",
          "Baltimore, MD",
          "St. Louis, MO",
          "San Antonio, TX",
          "Austin, TX",
          "Portland, OR",
          "Sacramento, CA",
          "Pittsburgh, PA",
          "Las Vegas, NV",
          "Cincinnati, OH",
          "Kansas City, MO",
          "Columbus, OH",
          "Indianapolis, IN",
          "Nashville, TN",
          "Cleveland, OH",
          "San Jose, CA",
          "Virginia Beach, VA",
          "Jacksonville, FL",
          "Providence, RI",
          "Raleigh, NC",
          "Milwaukee, WI",
          "Oklahoma City, OK",
          "Louisville, KY",
          "Richmond, VA",
          "Memphis, TN",
          "Salt Lake City, UT",
          "Fresno, CA",
          "Birmingham, AL",
          "Grand Rapids, MI",
          "Hartford, CT",
          "Buffalo, NY",
          "Tucson, AZ",
          "Tulsa, OK",
          "Rochester, NY",
          "Greenville, SC",
          "Omaha, NE",
          "Honolulu, HI",
          "Bridgeport, CT",
          "New Orleans, LA",
          "Knoxville, TN",
          "North Port, FL",
          "Bakersfield, CA",
          "Albuquerque, NM",
          "McAllen, TX",
          "Albany, NY",
          "Charleston, SC",
          "Baton Rouge, LA",
          "Worcester, MA",
          "Allentown, PA",
          "El Paso, TX",
          "Columbia, SC",
          "Cape Coral, FL",
          "Lakeland, FL",
          "Boise, ID",
          "Oxnard, CA",
          "Dayton, OH",
          "Stockton, CA",
          "Greensboro, NC",
          "Colorado Springs, CO",
          "Little Rock, AR",
          "Provo, UT",
          "Des Moines, IA",
          "Deltona, FL",
          "Poughkeepsie, NY",
          "Winston-Salem, NC",
          "Madison, WI",
          "Akron, OH",
          "Ogden, UT",
          "Palm Bay, FL",
          "Wichita, KS",
          "Syracuse, NY",
          "Augusta, GA",
          "Durham, NC",
          "Fayetteville, AR",
          "Harrisburg, PA",
          "Jackson, MS",
          "Spokane, WA",
          "Toledo, OH",
          "Chattanooga, TN",
          "New Haven, CT",
          "Reno, NV",
          "Portland, ME",
          "Scranton, PA",
          "Port St. Lucie, FL",
          "Lancaster, PA",
          "Modesto, CA",
          "Huntsville, AL",
          "Pensacola, FL",
          "Lexington, KY",
          "Killeen, TX",
          "Springfield, MO",
          "Wilmington, NC",
          "Santa Rosa, CA",
          "Visalia, CA",
          "Lansing, MI",
          "York, PA",
          "Fort Wayne, IN",
          "Springfield, MA",
          "Waterbury, CT",
          "Vallejo, CA",
          "Corpus Christi, TX",
          "Salem, OR",
          "Ocala, FL",
          "Santa Maria, CA",
          "Reading, PA",
          "Savannah, GA",
          "Brownsville, TX",
          "Salinas, CA",
          "Manchester, NH",
          "Gulfport, MS",
          "Myrtle Beach, SC",
          "Lafayette, LA",
          "Youngstown, OH",
          "Asheville, NC",
          "Naples, FL",
          "Mobile, AL",
          "Spartanburg, SC",
          "Anchorage, AK",
          "Flint, MI",
          "Canton, OH",
          "Beaumont, TX",
          "Trenton, NJ",
          "Tallahassee, FL",
          "Fayetteville, NC",
          "Montgomery, AL",
          "Shreveport, LA",
          "Eugene, OR",
          "Davenport, IA",
          "Greeley, CO",
          "Fort Collins, CO",
          "Hickory, NC",
          "Atlantic City, NJ",
          "Ann Arbor, MI",
          "Lubbock, TX",
          "Huntington, WV",
          "Peoria, IL",
          "Gainesville, FL",
          "Lincoln, NE",
          "Clarksville, TN",
          "Rockford, IL",
          "Green Bay, WI",
          "Boulder, CO",
          "Columbus, GA",
          "South Bend, IN",
          "Kennewick, WA",
          "Roanoke, VA",
          "Hagerstown, MD",
          "Crestview, FL",
          "Kingsport, TN",
          "Sioux Falls, SD",
          "Waco, TX",
          "Olympia, WA",
          "Longview, TX",
          "Merced, CA",
          "College Station, TX",
          "Utica, NY",
          "Norwich, CT",
          "Bremerton, WA",
          "San Luis Obispo, CA",
          "Tuscaloosa, AL",
          "Laredo, TX",
          "Duluth, MN",
          "Cedar Rapids, IA",
          "Slidell, LA",
          "Amarillo, TX",
          "Evansville, IN",
          "Fargo, ND",
          "Lynchburg, VA",
          "Daphne, AL",
          "Bend, OR",
          "Erie, PA",
          "Kalamazoo, MI",
          "Yakima, WA",
          "Santa Cruz, CA",
          "Prescott Valley, AZ",
          "Abilene, TX",
          "Albany, GA",
          "Albany, OR",
          "Altoona, PA",
          "Ames, IA",
          "Amherst Town, MA",
          "Anniston, AL",
          "Appleton, WI",
          "Auburn, AL",
          "Bangor, ME",
          "Barnstable Town, MA",
          "Battle Creek, MI",
          "Bay City, MI",
          "Beckley, WV",
          "Bellingham, WA",
          "Billings, MT",
          "Binghamton, NY",
          "Bismarck, ND",
          "Blacksburg, VA",
          "Bloomington, IL",
          "Bloomington, IN",
          "Bowling Green, KY",
          "Bozeman, MT",
          "Brunswick, GA",
          "Burlington, NC",
          "Burlington, VT",
          "Cape Girardeau, MO",
          "Carson City, NV",
          "Casper, WY",
          "Chambersburg, PA",
          "Champaign, IL",
          "Charleston, WV",
          "Charlottesville, VA",
          "Cheyenne, WY",
          "Chico, CA",
          "Cleveland, TN",
          "Coeur d'Alene, ID",
          "Columbia, MO",
          "Cumberland, MD",
          "Dalton, GA",
          "Danville, IL",
          "Decatur, AL",
          "Decatur, IL",
          "Dothan, AL",
          "Dover, DE",
          "Dubuque, IA",
          "Eau Claire, WI",
          "El Centro, CA",
          "Elizabethtown, KY",
          "Elkhart, IN",
          "Enid, OK",
          "Florence, AL",
          "Florence, SC",
          "Fort Smith, AR",
          "Gadsden, AL",
          "Gainesville, GA",
          "Gettysburg, PA",
          "Grand Forks, ND",
          "Grand Island, NE",
          "Grand Junction, CO",
          "Grants Pass, OR",
          "Great Falls, MT",
          "Greenville, NC",
          "Hammond, LA",
          "Hanford, CA",
          "Harrisonburg, VA",
          "Hattiesburg, MS",
          "Hilton Head Island, SC",
          "Hinesville, GA",
          "Homosassa Springs, FL",
          "Hot Springs, AR",
          "Houma, LA",
          "Idaho Falls, ID",
          "Iowa City, IA",
          "Ithaca, NY",
          "Jackson, MI",
          "Jackson, TN",
          "Jacksonville, NC",
          "Janesville, WI",
          "Jefferson City, MO",
          "Johnson City, TN",
          "Johnstown, PA",
          "Jonesboro, AR",
          "Joplin, MO",
          "Kahului, HI",
          "Kankakee, IL",
          "Kenosha, WI",
          "Kingston, NY",
          "Kokomo, IN",
          "La Crosse, WI",
          "Lafayette, IN",
          "Lake Charles, LA",
          "Lake Havasu City, AZ",
          "Las Cruces, NM",
          "Lawrence, KS",
          "Lawton, OK",
          "Lebanon, PA",
          "Lewiston, ME",
          "Lexington Park, MD",
          "Logan, UT",
          "Longview, WA",
          "Manhattan, KS",
          "Mankato, MN",
          "Mansfield, OH",
          "Medford, OR",
          "Michigan City, IN",
          "Midland, TX",
          "Missoula, MT",
          "Monroe, LA",
          "Monroe, MI",
          "Morgantown, WV",
          "Morristown, TN",
          "Mount Vernon, WA",
          "Muncie, IN",
          "Muskegon, MI",
          "Napa, CA",
          "Niles, MI",
          "Odessa, TX",
          "Oshkosh, WI",
          "Owensboro, KY",
          "Paducah, KY",
          "Panama City, FL",
          "Pine Bluff, AR",
          "Pinehurst, NC",
          "Pittsfield, MA",
          "Pueblo, CO",
          "Punta Gorda, FL",
          "Racine, WI",
          "Rapid City, SD",
          "Redding, CA",
          "Rochester, MN",
          "Rocky Mount, NC",
          "Rome, GA",
          "Saginaw, MI",
          "Salisbury, MD",
          "San Angelo, TX",
          "Sandusky, OH",
          "Santa Fe, NM",
          "Sebastian, FL",
          "Sebring, FL",
          "Sheboygan, WI",
          "Sherman, TX",
          "Sierra Vista, AZ",
          "Sioux City, IA",
          "Springfield, IL",
          "Springfield, OH",
          "St. Cloud, MN",
          "St. George, UT",
          "St. Joseph, MO",
          "State College, PA",
          "Staunton, VA",
          "Sumter, SC",
          "Terre Haute, IN",
          "Texarkana, TX",
          "Topeka, KS",
          "Traverse City, MI",
          "Tyler, TX",
          "Valdosta, GA",
          "Victoria, TX",
          "Vineland, NJ",
          "Walla Walla, WA",
          "Warner Robins, GA",
          "Waterloo, IA",
          "Watertown, NY",
          "Wausau, WI",
          "Weirton, WV",
          "Wenatchee, WA",
          "Wheeling, WV",
          "Wichita Falls, TX",
          "Wildwood, FL",
          "Williamsport, PA",
          "Winchester, VA",
          "Yuba City, CA",
          "Yuma, AZ",
          "Other"
        ],
        "hint": "Auto-filled from proforma import or guessed from the address; you can override manually. Pick \"Other\" for a market not listed.",
        "required": true,
        "row": "id_mkt"
      },
      {
        "key": "maps_link",
        "type": "maps_link",
        "label": "View on Google Maps",
        "addr_expr": "mailing_address ? [mailing_address, city, state, zip].filter(Boolean).join(', ') : ''",
        "row": "id_mkt"
      },
      {
        "key": "property_type",
        "label": "Property Type",
        "type": "select",
        "options": [
          "MFVA",
          "EXSTAY"
        ],
        "required": true,
        "row": "id_type"
      },
      {
        "key": "year_built",
        "label": "Year Built",
        "type": "number",
        "min": 1900,
        "max": 2026,
        "nocomma": true,
        "required": true,
        "row": "id_type"
      }
    ]
  },
  {
    "section": "Units",
    "fields": [
      {
        "key": "mf_units",
        "label": "# of MF Units",
        "type": "number",
        "min": 0,
        "required": true,
        "row": "un_units"
      },
      {
        "key": "current_occupancy",
        "label": "Current Occupancy",
        "type": "number",
        "min": 0,
        "max": 100,
        "step": 1,
        "pctOf1": true,
        "hint": "Whole number (75 = 75%)",
        "row": "un_units"
      }
    ]
  },
  {
    "section": "Area",
    "fields": [
      {
        "key": "mf_rsf",
        "label": "Multifamily RSF",
        "type": "number",
        "min": 0,
        "required": true,
        "row": "ar_rsf"
      },
      {
        "key": "commercial_rsf",
        "label": "Commercial RSF",
        "type": "number",
        "min": 0,
        "hint": "Enter 0 if none",
        "row": "ar_rsf"
      },
      {
        "key": "common_sf",
        "label": "Common Sqft",
        "type": "number",
        "min": 0,
        "decimals": 0,
        "hint": "Enter 0 if none",
        "row": "ar_rsf"
      },
      {
        "key": "overall_rsf",
        "label": "Overall Sqft",
        "type": "number",
        "computed": "mf_rsf + commercial_rsf + common_sf",
        "decimals": 0,
        "row": "ar_rsf"
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
        },
        "required": true,
        "row": "ar_land",
        "hint": "Total parcel / site area"
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
        },
        "row": "ar_land"
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
        "min": 0,
        "required": true,
        "hint": "Min 1",
        "row": "bs_bldg"
      },
      {
        "key": "vertical_floors",
        "label": "#  Floors (Per Bldg)",
        "type": "number",
        "min": 0,
        "hint": "Min 1",
        "row": "bs_bldg"
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
        "label": "# Elevators",
        "type": "number",
        "required": true,
        "hint": "Enter 0 if none",
        "inline": true
      },
      {
        "key": "elevator_year_install",
        "label": "Year Installed",
        "type": "number",
        "min": 1900,
        "max": 2100,
        "nocomma": true,
        "show_if": "elevators_yn > 0"
      },
      {
        "key": "elevator_passenger",
        "label": "# Passenger",
        "type": "number",
        "min": 0,
        "show_if": "elevators_yn > 0",
        "hint": "Enter 0 if none"
      },
      {
        "key": "elevator_freight",
        "label": "# Freight",
        "type": "number",
        "min": 0,
        "show_if": "elevators_yn > 0",
        "hint": "Enter 0 if none"
      },
      {
        "type": "divider",
        "key": "bs_div_1"
      },
      {
        "key": "total_site_area_sf",
        "label": "Total Site Area Sqft",
        "type": "number",
        "min": 0,
        "decimals": 0,
        "hint": "Auto = Land Sqft",
        "computed": "land_sf",
        "inline": true
      },
      {
        "key": "parking_lot_sf",
        "label": "Parking Lot Sqft",
        "type": "number",
        "min": 0,
        "hint": "Paved area curb-to-curb (stalls + drives)",
        "inline": true
      },
      {
        "key": "total_footprint_sf",
        "label": "Total All Buildings Sqft",
        "type": "number",
        "min": 0,
        "hint": "Sum across all buildings",
        "inline": true
      },
      {
        "key": "other_impervious_sf",
        "type": "number",
        "label": "Other Impervious Sqft",
        "hint": "Walks, pads, dumpster aprons",
        "inline": true
      },
      {
        "key": "landscaping_sf",
        "label": "Other Pervious Sqft",
        "type": "number",
        "min": 0,
        "hint": "Residual = land \u2212 bldg \u2212 parking \u2212 sidewalks; override if known",
        "label_info": "land_sf > 0 ? '('+((landscaping_sf||0)/land_sf*100).toFixed(1)+'% of site)' : ''",
        "inline": true
      },
      {
        "type": "divider",
        "key": "bs_div_2"
      },
      {
        "key": "total_roof_sf",
        "label": "Total All Roofs Sqft",
        "type": "number",
        "min": 0,
        "hint": "Pitch-adjusted (footprint \u00f7 cos(pitch))",
        "inline": true
      },
      {
        "key": "total_facade_sf",
        "label": "Total Facade Sqft",
        "type": "number",
        "min": 0,
        "hint": "Perimeter \u00d7 height, net of openings",
        "inline": true
      },
      {
        "type": "divider",
        "key": "bs_div_3"
      },
      {
        "key": "parking_spots_existing",
        "label": "# Parking Spots",
        "type": "number",
        "min": 0,
        "required": true,
        "inline": true
      },
      {
        "key": "parking_spots_hc",
        "label": "# Handicap Parking",
        "type": "number",
        "min": 0,
        "hint": "Of total parking above",
        "inline": true
      },
      {
        "type": "divider",
        "key": "bs_div_4"
      },
      {
        "key": "site_perimeter_lf",
        "label": "Site Perimeter",
        "type": "number",
        "min": 0,
        "hint": "Linear Ft (sum of boundary segments)",
        "inline": true
      },
      {
        "key": "fence_feet",
        "type": "number",
        "label": "Fence Feet",
        "required": true,
        "hint": "Linear Ft -Enter 0 if none",
        "inline": true
      },
      {
        "key": "pedestrian_gates",
        "type": "number",
        "label": "# Pedestrian Gates",
        "show_if": "fence_feet > 0",
        "hint": "Enter 0 if none"
      },
      {
        "key": "vehicle_gates",
        "type": "number",
        "label": "# Vehicle Gates",
        "show_if": "fence_feet > 0",
        "hint": "Enter 0 if none"
      },
      {
        "key": "fencing_notes",
        "label": "Fencing Notes",
        "type": "textarea",
        "hint": "Type / LF / location \u00b7 \"n/a\" if none",
        "inline": true
      },
      {
        "key": "gates_notes",
        "label": "Gates Notes",
        "type": "textarea",
        "hint": "Count / type / location \u00b7 \"n/a\" if none",
        "inline": true
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
        ],
        "required": true
      },
      {
        "key": "roof_shape",
        "label": "Roof Shape",
        "type": "select",
        "options": [
          "Pitched",
          "Flat"
        ],
        "required": true
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
        "key": "garage",
        "label": "# Garage",
        "type": "number",
        "required": true,
        "hint": "Enter 0 if none"
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
        "key": "walkways",
        "type": "number",
        "label": "# Walkways",
        "hint": "Enter 0 if none"
      },
      {
        "key": "walkway_length",
        "label": "Length",
        "type": "number",
        "min": 0,
        "hint": "Feet",
        "show_if": "walkways > 0",
        "row": "walkway_dims"
      },
      {
        "key": "walkway_width",
        "label": "Width",
        "type": "number",
        "min": 0,
        "hint": "Feet",
        "show_if": "walkways > 0",
        "row": "walkway_dims"
      },
      {
        "key": "stairways",
        "type": "number",
        "label": "# Stairways",
        "hint": "Enter 0 if none"
      },
      {
        "key": "new_railing_lf",
        "label": "# Railings",
        "type": "number",
        "min": 0,
        "hint": "Linear Ft"
      },
      {
        "key": "private_yard_existing",
        "label": "# Private Yards",
        "type": "number",
        "min": 0,
        "hint": "Enter 0 if none"
      },
      {
        "key": "yard_perimeter_lf",
        "label": "Yard Perimeter (Avg)",
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
        ],
        "required": true
      },
      {
        "key": "patios",
        "label": "Patios",
        "type": "select",
        "options": [
          "Yes",
          "No"
        ],
        "required": true
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
      },
      {
        "key": "fencing_existing_lf",
        "label": "Fencing",
        "type": "number",
        "min": 0,
        "hint": "Linear Ft"
      }
    ]
  },
  {
    "section": "Common Interiors",
    "fields": [
      {
        "key": "hallway_length",
        "label": "Hallway Length",
        "type": "number",
        "min": 0,
        "hint": "Feet",
        "show_if": "hallways > 0"
      },
      {
        "key": "hallway_width",
        "label": "Hallway Width",
        "type": "number",
        "min": 0,
        "hint": "Feet",
        "show_if": "hallways > 0"
      },
      {
        "key": "hallway_info",
        "type": "info",
        "expr": "`Area per hallway: ${Math.round((hallway_length||0)*(hallway_width||0)).toLocaleString()} Sqft \u00b7 Total hallways: ${(p1_num_buildings||0)*(p1_vertical_floors||0)} (${p1_num_buildings||0} bldgs \u00d7 ${p1_vertical_floors||0} floors)`",
        "show_if": "hallways > 0"
      },
      {
        "key": "hallways",
        "type": "number",
        "label": "# Hallways",
        "hint": "Enter 0 if none"
      },
      {
        "key": "atrium_interior",
        "type": "number",
        "label": "Interior Atrium Sqft",
        "hint": "Enter 0 if none"
      },
      {
        "key": "stairwells",
        "type": "number",
        "label": "# Stairwells",
        "hint": "Enter 0 if none"
      }
    ]
  },
  {
    "section": "UNIT Interiors",
    "fields": [
      {
        "key": "flooring",
        "label": "Flooring",
        "type": "select",
        "options": [
          "Vinyl Plank",
          "Hardwood",
          "Carpeted",
          "Carpet+Vinyl Mix",
          "Hard 1st + Carpet 2nd"
        ]
      },
      {
        "key": "appliances",
        "type": "select",
        "label": "Appliances",
        "options": [
          "White",
          "Black",
          "Stainless Steel"
        ]
      }
    ]
  },
  {
    "section": "Mechanical (HVAC)",
    "fields": [
      {
        "key": "cooling",
        "label": "Cooling Type",
        "type": "select",
        "options": [
          "Ind. Condenser",
          "Chiller FCUs",
          "PTAC",
          "VTAC"
        ],
        "required": true
      },
      {
        "key": "heating",
        "label": "Heating Type",
        "type": "select",
        "options": [
          "Ind. Furnace",
          "Boiler Radiator",
          "Boiler FCUs",
          "PTAC",
          "VTAC"
        ],
        "required": true
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
        ],
        "required": true
      },
      {
        "key": "hot_water_count",
        "label": "# Hot Water",
        "type": "number",
        "min": 0,
        "dynamic_label": "`# ${hot_water_type || '[Hot Water Type]'}`",
        "show_if": "hot_water_type",
        "per_mf_unit": true
      },
      {
        "key": "plumbing_pipes",
        "label": "Water-In Pipes-Type",
        "type": "select",
        "options": [
          "Steel",
          "PVC",
          "Cast Iron"
        ]
      },
      {
        "key": "sewer_pipes",
        "label": "Sewer-Out Pipes -Type",
        "type": "select",
        "options": [
          "Steel",
          "PVC",
          "Cast Iron"
        ]
      },
      {
        "key": "showerhead_aerated",
        "label": "Showerhead Aerated?",
        "type": "select",
        "options": [
          "Yes",
          "No"
        ]
      },
      {
        "key": "bath_sink_aerated",
        "label": "Bathroom Faucet Aerated?",
        "type": "select",
        "options": [
          "Yes",
          "No"
        ]
      },
      {
        "key": "toilet_low_flow",
        "label": "Toilet GPF",
        "type": "number",
        "hint": "Gallons Per Flush"
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
          "Yes-Aluminum Wiring",
          "Yes-Stablock Replace",
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
        ],
        "show_if": "(panel_in_unit || '').indexOf('Yes') === 0"
      },
      {
        "key": "panel_voltage",
        "label": "Panel Voltage",
        "type": "select",
        "options": [
          "120V",
          "240V"
        ],
        "show_if": "(panel_in_unit || '').indexOf('Yes') === 0"
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
        "label": "# Outdoor Pool(s)",
        "type": "number",
        "min": 0,
        "required": true,
        "hint": "Enter 0 if none"
      },
      {
        "key": "dog_parks",
        "label": "# Dog Park(s)",
        "type": "number",
        "min": 0,
        "required": true,
        "hint": "Enter 0 if none"
      },
      {
        "key": "soccer_field",
        "label": "# Play Field(s)",
        "type": "number",
        "required": true,
        "hint": "Enter 0 if none"
      },
      {
        "key": "sport_court_outdoor",
        "type": "number",
        "label": "Outdoor Sport Court(s)",
        "required": true,
        "hint": "Enter 0 if none"
      }
    ]
  },
  {
    "section": "Amenities - Indoor",
    "fields": [
      {
        "key": "gym_space",
        "label": "Gym Space Sqft",
        "type": "number",
        "min": 0,
        "hint": "Enter 0 if none",
        "required": true
      },
      {
        "key": "gym_equipment",
        "label": "Gym Equipment",
        "type": "select",
        "options": [
          "Full Equipment Needed",
          "Add More Equipment",
          "Good Equipment"
        ],
        "show_if": "gym_space > 0"
      },
      {
        "key": "laundry_facilities",
        "label": "# Laundry Facilities",
        "type": "number",
        "min": 0,
        "required": true,
        "hint": "Enter 0 if none"
      },
      {
        "key": "machines_per_facility",
        "label": "Machines/ Laundry Facility",
        "type": "number",
        "min": 0,
        "show_if": "laundry_facilities > 0"
      },
      {
        "key": "indoor_pools",
        "label": "# Indoor Pool(s)",
        "type": "number",
        "min": 0,
        "required": true,
        "hint": "Enter 0 if none"
      },
      {
        "key": "pool_heater",
        "label": "Pool Heater",
        "type": "select",
        "options": [
          "Yes",
          "No"
        ],
        "show_if": "indoor_pools > 0"
      },
      {
        "key": "sport_court_indoor",
        "label": "# Sport Indoor Court(s)",
        "type": "number",
        "required": true,
        "hint": "Enter 0 if none"
      },
      {
        "key": "leasing_office_2",
        "type": "select",
        "label": "Leasing Office Type",
        "options": [
          "Re-Brand Only",
          "Full Renovation",
          "Equipment Only",
          "Furniture Only"
        ],
        "required": true
      },
      {
        "key": "business_center",
        "type": "select",
        "label": "Business Center(s)",
        "options": [
          "Yes",
          "No"
        ],
        "required": true
      },
      {
        "key": "other_amenity",
        "type": "select",
        "label": "Other Amenity",
        "options": [
          "Theater",
          "Deck",
          "karaoke room",
          "yoga studio",
          "field games",
          "arcade"
        ]
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
            "name": "Zoning",
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
            "name": "Fire Sprinkler Plans",
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
            "name": "General Storage",
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
            "default_qty_type": "Each"
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
            "default_qty_type": "Each"
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
            "default_qty_type": "Each"
          },
          {
            "name": "Sprinkler - Vault Heater",
            "default_cost_per_item": 2500.0,
            "notes": "if needed",
            "gl_account": "17917: CIP Base - Fire Protection - Sprinkler",
            "default_qty_type": "Each"
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
            "default_qty_type": "Each"
          },
          {
            "name": "Transformer Pad",
            "default_cost_per_item": 30000.0,
            "notes": "+ Pad & Bollards",
            "gl_account": "17371: CIP Base - Electrical",
            "default_qty_type": "Each"
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
            "name": "Asphalt Overlay",
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
            "default_qty_type": "Each"
          },
          {
            "name": "Bike Racks",
            "default_cost_per_item": 5000.0,
            "notes": null,
            "gl_account": "17530: CIP Parking Lot",
            "default_qty_type": "Each"
          },
          {
            "name": "# Parks Added - New Asphalt",
            "default_cost_per_item": 2000.0,
            "notes": null,
            "gl_account": "17535: CIP Parking Lot - Asphalt (15 Yrs)",
            "default_qty_type": "Each"
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
            "default_qty_type": "Each"
          },
          {
            "name": "Submeters Materials",
            "default_cost_per_item": 100.0,
            "notes": "owned by Utility Co",
            "gl_account": "17370: CIP Building - Electrical Submetering (15 Yrs)",
            "default_qty_type": "MF Unit"
          },
          {
            "name": "Submeters Labor",
            "default_cost_per_item": 100.0,
            "notes": "done by Utility Co",
            "gl_account": "17370: CIP Building - Electrical Submetering (15 Yrs)",
            "default_qty_type": "MF Unit"
          },
          {
            "name": "Egress Lights",
            "default_cost_per_item": 500.0,
            "notes": "done by Utility Co",
            "gl_account": "17370: CIP Building - Electrical Submetering (15 Yrs)",
            "default_qty_type": "Int. Hall"
          }
        ]
      },
      {
        "name": "FIRE PROTECTION",
        "items": [
          {
            "name": "Alarm Control Panel",
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
            "name": "Riser Room Setup",
            "default_cost_per_item": 25000.0,
            "notes": null,
            "gl_account": "17365: CIP Building - Fire Protection - Sprinklers",
            "default_qty_type": "Each"
          },
          {
            "name": "Riser Room Heater",
            "default_cost_per_item": 2500.0,
            "notes": null,
            "gl_account": "17365: CIP Building - Fire Protection - Sprinklers",
            "default_qty_type": "Each"
          },
          {
            "name": "Sprinkler Lines",
            "default_cost_per_item": 3.0,
            "notes": null,
            "gl_account": "17365: CIP Building - Fire Protection - Sprinklers",
            "default_qty_type": "Sqft"
          },
          {
            "name": "Fire Ceiling Assembly",
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
            "default_qty_type": "Each"
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
            "name": "Interior Demo Labor",
            "default_cost_per_item": 250.0,
            "notes": null,
            "gl_account": "17101: CIP Interior - Renovation Labor",
            "default_qty_type": "Reno Unit"
          },
          {
            "name": "Materials Import Tax",
            "default_cost_per_item": 20.0,
            "notes": null,
            "gl_account": "17230: CIP Interior - Freight/Overseas Shipping",
            "default_qty_type": "%"
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
          },
          {
            "name": "Electrical Panel (In-Unit)",
            "default_cost_per_item": 500.0,
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
            "name": "Drywall Materials",
            "default_cost_per_item": 1.53,
            "notes": null,
            "gl_account": "17190: CIP Interior - Drywall",
            "default_qty_type": "Sqft"
          },
          {
            "name": "Drywall Labor",
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
            "name": "Door Repairs",
            "default_cost_per_item": 15.0,
            "notes": null,
            "gl_account": "17170: CIP Interior - Doors & Hardware",
            "default_qty_type": "Avg # BRs"
          },
          {
            "name": "Toilet",
            "default_cost_per_item": 100.0,
            "notes": null,
            "gl_account": "17130 - CIP Interior - Plumbing Fixtures (7 Yrs)",
            "default_qty_type": "Avg # BAs"
          },
          {
            "name": "Trim & Molding",
            "default_cost_per_item": 500.0,
            "notes": null,
            "gl_account": "17225: CIP Interior - Trim & Molding",
            "default_qty_type": "Reno Unit"
          },
          {
            "name": "Blinds",
            "default_cost_per_item": 50.0,
            "notes": null,
            "gl_account": "17122: CIP Interior - Blinds (5 Yrs)",
            "default_qty_type": "Avg # BRs"
          },
          {
            "name": "Interior Paint",
            "default_cost_per_item": 0.5,
            "notes": null,
            "gl_account": "17160: CIP Interior - Paint",
            "default_qty_type": "Avg Sqft"
          },
          {
            "name": "Misc. Materials",
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
      },
      {
        "name": "PER UNIT INTERIOR",
        "items": [
          {
            "name": "Yard - New",
            "default_cost_per_item": 2000.0,
            "notes": null,
            "gl_account": "17435: CIP Fence/Gate (15 Yrs)",
            "default_qty_type": "Reno Unit"
          },
          {
            "name": "Balcony/Deck",
            "default_cost_per_item": 500.0,
            "notes": null,
            "gl_account": "17600 - CIP Deck Renovations (7 Yrs)",
            "default_qty_type": "Reno Unit"
          },
          {
            "name": "W/D Hookup",
            "default_cost_per_item": 1000.0,
            "notes": null,
            "gl_account": "17133 - CIP Interior - Plumbing Rough-In",
            "default_qty_type": "Reno Unit"
          },
          {
            "name": "W/D Machines",
            "default_cost_per_item": 1000.0,
            "notes": null,
            "gl_account": "17125 - CIP Interior - Appliances (5 Yrs)",
            "default_qty_type": "Reno Unit"
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
            "name": "Dumpsters",
            "default_cost_per_item": 500.0,
            "notes": null,
            "gl_account": "17570: CIP Trash/Dumpster",
            "default_qty_type": "Cubic Yard"
          },
          {
            "name": "Stairways",
            "default_cost_per_item": 25.0,
            "notes": "Riser Fill In",
            "gl_account": "17330: CIP Exterior Stairs",
            "default_qty_type": "Sqft"
          },
          {
            "name": "Security Cameras",
            "default_cost_per_item": 100.0,
            "notes": "Permanent (leasing, storage, parking)",
            "gl_account": "17595: CIP Security Cameras",
            "default_qty_type": "Device"
          },
          {
            "name": "Exterior Doors",
            "default_cost_per_item": 1000.0,
            "notes": "for replacement",
            "gl_account": "17396: CIP Exterior - Common Doors",
            "default_qty_type": "Each"
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
            "default_qty_type": "Each"
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
            "default_qty_type": "Each"
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
            "default_qty_type": "Each"
          },
          {
            "name": "Unit Door",
            "default_cost_per_item": 250.0,
            "notes": null,
            "gl_account": "17395: CIP Exterior - Doors Per Unit",
            "default_qty_type": "Each"
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
            "default_cost_per_item": 2500.0,
            "notes": null,
            "gl_account": "17425: CIP Exterior - Windows",
            "default_qty_type": "Avg # BRs"
          },
          {
            "name": "New Yard",
            "default_cost_per_item": 1500.0,
            "notes": null,
            "gl_account": "17435: CIP Fence/Gate (15 Yrs)",
            "default_qty_type": "Each"
          },
          {
            "name": "Patio --> Yard",
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
            "name": "New Railings",
            "default_cost_per_item": 25.0,
            "notes": "Repair/Replace",
            "gl_account": "17325: CIP Exterior - Railings",
            "default_qty_type": "Railing Lin-ft"
          },
          {
            "name": "Sandblasting",
            "default_cost_per_item": 10.0,
            "notes": null,
            "gl_account": "17325: CIP Exterior - Railings",
            "default_qty_type": "Railing Lin-ft"
          },
          {
            "name": "Panels",
            "default_cost_per_item": 5.0,
            "notes": null,
            "gl_account": "17325: CIP Exterior - Railings",
            "default_qty_type": "Railing Sqft"
          },
          {
            "name": "Welder - Labor",
            "default_cost_per_item": 5.0,
            "notes": null,
            "gl_account": "17325: CIP Exterior - Railings",
            "default_qty_type": "Railing Lin-ft"
          }
        ]
      },
      {
        "name": "WALKWAYS",
        "items": [
          {
            "name": "New - Materials",
            "default_cost_per_item": 2.5,
            "notes": null,
            "gl_account": "17335: CIP Exterior Walkways",
            "default_qty_type": "Walkway Sqft"
          },
          {
            "name": "New - Labor",
            "default_cost_per_item": 2.5,
            "notes": null,
            "gl_account": "17335: CIP Exterior Walkways",
            "default_qty_type": "Walkway Sqft"
          },
          {
            "name": "Concrete Finish Coat",
            "default_cost_per_item": 1.0,
            "notes": null,
            "gl_account": "17335: CIP Exterior Walkways",
            "default_qty_type": "Walkway Sqft"
          },
          {
            "name": "Welder",
            "default_cost_per_item": 1.0,
            "notes": null,
            "gl_account": "17335: CIP Exterior Walkways",
            "default_qty_type": "Walkway Sqft"
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
            "name": "New Siding Materials",
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
          },
          {
            "name": "Brick Pointing",
            "default_cost_per_item": 1.5,
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
            "name": "Laundry Room Build",
            "default_cost_per_item": 25000.0,
            "notes": null,
            "gl_account": "17830: CIP Laundry Room",
            "default_qty_type": "Each"
          },
          {
            "name": "Laundry Machines",
            "default_cost_per_item": 500.0,
            "notes": null,
            "gl_account": "17830: CIP Laundry Room",
            "default_qty_type": "Each"
          },
          {
            "name": "Common Bathrooms",
            "default_cost_per_item": 10000.0,
            "notes": null,
            "gl_account": "17690: CIP Common - Common Bathrooms",
            "default_qty_type": "Each"
          },
          {
            "name": "Dog Park Build",
            "default_cost_per_item": 15000.0,
            "notes": null,
            "gl_account": "17620: CIP Dog Park (15 Yrs)",
            "default_qty_type": "Each"
          },
          {
            "name": "Dog Park Equipment",
            "default_cost_per_item": 25000.0,
            "notes": null,
            "gl_account": "17620: CIP Dog Park (15 Yrs)",
            "default_qty_type": "Each"
          },
          {
            "name": "Fire Pit",
            "default_cost_per_item": 15000.0,
            "notes": null,
            "gl_account": "17615: CIP Fire Pit/BBQ",
            "default_qty_type": "Each"
          },
          {
            "name": "Sport Court",
            "default_cost_per_item": 50000.0,
            "notes": null,
            "gl_account": "17650: CIP Playground (15 Yrs)",
            "default_qty_type": "Each"
          },
          {
            "name": "Playground",
            "default_cost_per_item": 25000.0,
            "notes": null,
            "gl_account": "17650: CIP Playground (15 Yrs)",
            "default_qty_type": "Each"
          },
          {
            "name": "Outdoor Kitchen",
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
            "name": "Gym Build",
            "default_cost_per_item": 30000.0,
            "notes": null,
            "gl_account": "17630: CIP Fitness Center Build Out",
            "default_qty_type": "Each"
          },
          {
            "name": "Gym Equipment",
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
            "name": "Elevator Demo",
            "default_cost_per_item": 10000.0,
            "notes": null,
            "gl_account": "17385: CIP Elevator",
            "default_qty_type": "Each"
          },
          {
            "name": "Elevator Hoistway",
            "default_cost_per_item": 15000.0,
            "notes": null,
            "gl_account": "17385: CIP Elevator",
            "default_qty_type": "Each"
          },
          {
            "name": "Elevator Cab",
            "default_cost_per_item": 25000.0,
            "notes": null,
            "gl_account": "17385: CIP Elevator",
            "default_qty_type": "Each"
          },
          {
            "name": "Elevator Machinery",
            "default_cost_per_item": 25000.0,
            "notes": null,
            "gl_account": "17385: CIP Elevator",
            "default_qty_type": "Each"
          },
          {
            "name": "Elevator Pit Sump Pump",
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
        "name": "CLUBHOUSE",
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
            "name": "Clubhouse Drywall",
            "default_cost_per_item": 15000.0,
            "notes": "Materials & Labor",
            "gl_account": "17635: CIP Leasing Center Build Out",
            "default_qty_type": "Each"
          },
          {
            "name": "Clubhouse Finishes",
            "default_cost_per_item": 25000.0,
            "notes": "Materials & Labor",
            "gl_account": "17635: CIP Leasing Center Build Out",
            "default_qty_type": "Each"
          },
          {
            "name": "Clubhouse FF&E",
            "default_cost_per_item": 25000.0,
            "notes": null,
            "gl_account": "17805: CIP Common Area FF&E",
            "default_qty_type": "Each"
          },
          {
            "name": "Clubhouse Sound System",
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
            "default_qty_type": "Each"
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
window.SURVEY_EXTRACTION_PROMPT = "You are a real estate survey analyst. Extract physical site specs from the survey PDF and return a JSON object. Return ONLY the raw JSON \u2014 no markdown fences, no explanation.\n\nJSON schema:\n{\n  \"flat\": {\n    \"parking_regular\": number|null,\n    \"parking_spots_hc\": number|null,\n    \"parking_spots_existing\": number|null,\n    \"land_sf\": number|null,\n    \"land_acres\": number|null,\n    \"site_perimeter_lf\": number|null,\n    \"fencing_notes\": \"string or n/a\",\n    \"gates_notes\": \"string or n/a\",\n    \"fence_feet\": number|null,\n    \"vehicle_gates\": number|null,\n    \"pedestrian_gates\": number|null,\n    \"parking_lot_sf\": number|null,\n    \"other_impervious_sf\": number|null,\n    \"num_buildings\": number|null,\n    \"total_footprint_sf\": number|null,\n    \"total_roof_sf\": number|null,\n    \"total_facade_sf\": number|null,\n    \"landscaping_sf\": number|null\n  },\n  \"buildings\": [\n    {\n      \"label\": \"string\",\n      \"footprint_sf\": number|null,\n      \"width_ft\": number|null,\n      \"length_ft\": number|null,\n      \"dimensions\": \"footprint shape / dimension notes for irregular plans, else empty\",\n      \"stories\": number|null,\n      \"height_ft\": number|null,\n      \"roof_pitch\": \"e.g. 4:12 or flat\",\n      \"roof_sf\": number|null,\n      \"facade_sf\": number|null\n    }\n  ],\n  \"meta\": {\n    \"property_name\": \"string\",\n    \"survey_date\": \"YYYY-MM-DD\",\n    \"address\": \"string\",\n    \"scale_paper\": \"e.g. 1 inch = 30 feet\",\n    \"ft_per_pixel\": number|null\n  },\n  \"notes\": \"any cross-reference notes as a single string\",\n  \"discrepancies\": [\"array of discrepancy strings\"]\n}\n\nRules:\n- Use null (not 0, not empty string) for any value you cannot determine.\n- fencing_notes / gates_notes: use \"n/a\" if the survey shows none.\n- fence_feet = total linear feet of fencing shown on the survey (0 if none drawn); vehicle_gates / pedestrian_gates = counts of gate symbols (0 if none).\n- other_impervious_sf = sidewalk / concrete flatwork SF (walks, patios, pads \u2014 excluding the parking lot).\n- parking_spots_existing = regular + HC total.\n- Buildings with sections of DIFFERENT floor counts (e.g. a 1-story lobby wing + 10-story tower): list each section as its own buildings-array entry with its own footprint/stories/height, labeled \"<Building> \u2014 <N>-story <section>\".\n- width_ft / length_ft = the rectangular envelope of that building/section from survey dimension callouts or the scaled drawing; for irregular plans leave them null and describe the shape in \"dimensions\".\n- total_footprint_sf = sum of all buildings footprint_sf.\n- total_roof_sf = sum of all buildings roof_sf.\n- total_facade_sf = sum of all buildings facade_sf.\n- landscaping_sf \u2248 land_sf \u2212 total_footprint_sf \u2212 parking_lot_sf.\n- roof_sf per building = footprint_sf multiplied by pitch factor: flat=1.02, 3:12=1.031, 4:12=1.054, 5:12=1.083, 6:12=1.118, 8:12=1.202.\n- List each building separately in the buildings array.\n- Extract the graphic scale bar or stated paper scale to populate meta fields.";
