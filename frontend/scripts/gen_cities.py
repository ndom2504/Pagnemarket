"""One-shot generator: frontend/src/cities.ts — at least 10 cities per ISO."""
import re
from pathlib import Path

CITIES: dict[str, list[str]] = {
    "AF": ["Kaboul", "Kandahar", "Hérat", "Mazar-e Charif", "Jalalabad", "Kunduz", "Ghazni", "Lashkar Gah", "Taloqan", "Puli Khumri"],
    "ZA": ["Johannesburg", "Le Cap", "Durban", "Pretoria", "Port Elizabeth", "Bloemfontein", "East London", "Polokwane", "Nelspruit", "Kimberley", "Soweto"],
    "AL": ["Tirana", "Durrës", "Vlorë", "Shkodër", "Elbasan", "Korçë", "Fier", "Berat", "Lushnjë", "Pogradec"],
    "DZ": ["Alger", "Oran", "Constantine", "Annaba", "Blida", "Batna", "Sétif", "Tlemcen", "Béjaïa", "Tizi Ouzou", "Biskra"],
    "DE": ["Berlin", "Hambourg", "Munich", "Cologne", "Francfort", "Stuttgart", "Düsseldorf", "Leipzig", "Dortmund", "Essen", "Brême"],
    "AD": ["Andorre-la-Vieille", "Escaldes-Engordany", "Encamp", "Sant Julià de Lòria", "La Massana", "Canillo", "Ordino", "Pas de la Casa", "Santa Coloma", "Arinsal"],
    "AO": ["Luanda", "Huambo", "Lobito", "Benguela", "Lubango", "Kuito", "Malanje", "Cabinda", "Soyo", "Namibe"],
    "SA": ["Riyad", "Djeddah", "La Mecque", "Médine", "Dammam", "Khobar", "Taëf", "Abha", "Tabuk", "Buraidah"],
    "AR": ["Buenos Aires", "Córdoba", "Rosario", "Mendoza", "La Plata", "San Miguel de Tucumán", "Mar del Plata", "Salta", "Santa Fe", "San Juan"],
    "AM": ["Erevan", "Gyumri", "Vanadzor", "Vagharshapat", "Hrazdan", "Abovyan", "Kapan", "Armavir", "Gavar", "Artashat"],
    "AU": ["Sydney", "Melbourne", "Brisbane", "Perth", "Adélaïde", "Canberra", "Gold Coast", "Newcastle", "Hobart", "Darwin"],
    "AT": ["Vienne", "Graz", "Linz", "Salzbourg", "Innsbruck", "Klagenfurt", "Villach", "Wels", "Sankt Pölten", "Dornbirn"],
    "AZ": ["Bakou", "Ganja", "Sumqayıt", "Mingachevir", "Lankaran", "Shirvan", "Nakhchivan", "Shaki", "Yevlakh", "Khachmaz"],
    "BS": ["Nassau", "Freeport", "West End", "Coopers Town", "Marsh Harbour", "George Town", "Andros Town", "Dunmore Town", "Matthew Town", "Alice Town"],
    "BH": ["Manama", "Riffa", "Muharraq", "Hamad Town", "A'ali", "Isa Town", "Sitra", "Budaiya", "Jidhafs", "Zallaq"],
    "BD": ["Dacca", "Chittagong", "Khulna", "Rajshahi", "Sylhet", "Barisal", "Rangpur", "Comilla", "Mymensingh", "Gazipur"],
    "BE": ["Bruxelles", "Anvers", "Gand", "Charleroi", "Liège", "Bruges", "Namur", "Louvain", "Mons", "Ostende"],
    "BJ": ["Cotonou", "Porto-Novo", "Parakou", "Djougou", "Bohicon", "Abomey", "Natitingou", "Lokossa", "Ouidah", "Kandi", "Save"],
    "BT": ["Thimphou", "Phuentsholing", "Paro", "Punakha", "Wangdue Phodrang", "Gelephu", "Samdrup Jongkhar", "Trashigang", "Jakar", "Mongar"],
    "BY": ["Minsk", "Gomel", "Moguilev", "Vitebsk", "Grodno", "Brest", "Babrouïsk", "Baranavitchy", "Baryssaw", "Pinsk"],
    "MM": ["Rangoun", "Mandalay", "Naypyidaw", "Mawlamyine", "Bago", "Pathein", "Monywa", "Sittwe", "Meiktila", "Taunggyi"],
    "BO": ["La Paz", "Santa Cruz de la Sierra", "Cochabamba", "Sucre", "Oruro", "Tarija", "Potosí", "Sacaba", "El Alto", "Trinidad"],
    "BA": ["Sarajevo", "Banja Luka", "Tuzla", "Zenica", "Mostar", "Bijeljina", "Brčko", "Prijedor", "Doboj", "Cazin"],
    "BW": ["Gaborone", "Francistown", "Molepolole", "Maun", "Serowe", "Selibe Phikwe", "Kanye", "Mochudi", "Mahalapye", "Lobatse"],
    "BR": ["São Paulo", "Rio de Janeiro", "Brasilia", "Salvador", "Fortaleza", "Belo Horizonte", "Manaus", "Curitiba", "Recife", "Porto Alegre"],
    "BN": ["Bandar Seri Begawan", "Kuala Belait", "Seria", "Tutong", "Bangar", "Muara", "Jerudong", "Lumut", "Sukang", "Labi"],
    "BG": ["Sofia", "Plovdiv", "Varna", "Bourgas", "Roussé", "Stara Zagora", "Pleven", "Sliven", "Dobritch", "Choumen"],
    "BF": ["Ouagadougou", "Bobo-Dioulasso", "Koudougou", "Banfora", "Ouahigouya", "Kaya", "Fada N'Gourma", "Dédougou", "Tenkodogo", "Réo", "Houndé"],
    "BI": ["Gitega", "Bujumbura", "Muyinga", "Ngozi", "Ruyigi", "Kayanza", "Bururi", "Rutana", "Makamba", "Cibitoke"],
    "KH": ["Phnom Penh", "Siem Reap", "Battambang", "Sihanoukville", "Kampong Cham", "Kampot", "Pursat", "Takeo", "Kratie", "Poipet"],
    "CM": ["Yaoundé", "Douala", "Garoua", "Bamenda", "Maroua", "Bafoussam", "Ngaoundéré", "Bertoua", "Loum", "Kumba", "Limbé", "Ebolowa"],
    "CA": ["Toronto", "Montréal", "Vancouver", "Calgary", "Edmonton", "Ottawa", "Winnipeg", "Québec", "Hamilton", "Halifax"],
    "CV": ["Praia", "Mindelo", "Santa Maria", "Assomada", "Espargos", "São Filipe", "Tarrafal", "Porto Novo", "Pedra Badejo", "Sal Rei"],
    "CL": ["Santiago", "Valparaíso", "Concepción", "La Serena", "Antofagasta", "Temuco", "Rancagua", "Talca", "Arica", "Puerto Montt"],
    "CN": ["Pékin", "Shanghai", "Canton", "Shenzhen", "Chengdu", "Chongqing", "Tianjin", "Wuhan", "Hangzhou", "Nankin", "Xi'an"],
    "CY": ["Nicosie", "Limassol", "Larnaca", "Paphos", "Famagouste", "Kyrenia", "Paralimni", "Morphou", "Protaras", "Ayia Napa"],
    "CO": ["Bogota", "Medellín", "Cali", "Barranquilla", "Carthagène", "Cúcuta", "Bucaramanga", "Pereira", "Santa Marta", "Ibagué"],
    "KM": ["Moroni", "Mutsamudu", "Fomboni", "Domoni", "Tsidjé", "Ouani", "Iconi", "Mitsamiouli", "Mbéni", "Sima"],
    "CG": ["Brazzaville", "Pointe-Noire", "Dolisie", "Nkayi", "Ouesso", "Owando", "Sibiti", "Madingou", "Impfondo", "Kinkala"],
    "CD": ["Kinshasa", "Lubumbashi", "Mbuji-Mayi", "Kananga", "Kisangani", "Bukavu", "Goma", "Kolwezi", "Likasi", "Matadi", "Mbandaka"],
    "KP": ["Pyongyang", "Hamhung", "Chongjin", "Nampo", "Wonsan", "Sinuiju", "Kaesong", "Sariwon", "Haeju", "Kanggye"],
    "KR": ["Séoul", "Busan", "Incheon", "Daegu", "Daejeon", "Gwangju", "Suwon", "Ulsan", "Changwon", "Goyang"],
    "CR": ["San José", "Alajuela", "Cartago", "Heredia", "Liberia", "Puntarenas", "Limón", "Desamparados", "Perez Zeledon", "Nicoya"],
    "CI": ["Abidjan", "Bouaké", "Yamoussoukro", "Daloa", "San-Pédro", "Korhogo", "Man", "Gagnoa", "Divo", "Abengourou", "Grand-Bassam", "Anyama"],
    "HR": ["Zagreb", "Split", "Rijeka", "Osijek", "Zadar", "Pula", "Slavonski Brod", "Karlovac", "Varazdin", "Dubrovnik"],
    "CU": ["La Havane", "Santiago de Cuba", "Camagüey", "Holguín", "Santa Clara", "Guantánamo", "Bayamo", "Cienfuegos", "Pinar del Río", "Matanzas"],
    "DK": ["Copenhague", "Aarhus", "Odense", "Aalborg", "Esbjerg", "Randers", "Kolding", "Horsens", "Vejle", "Roskilde"],
    "DJ": ["Djibouti", "Ali Sabieh", "Tadjourah", "Obock", "Dikhil", "Arta", "Holhol", "Doraleh", "Loyada", "Yoboki"],
    "DM": ["Roseau", "Portsmouth", "Marigot", "Mahaut", "Canefield", "Grand Bay", "Castle Bruce", "La Plaine", "Wesley", "Soufrière"],
    "EG": ["Le Caire", "Alexandrie", "Gizeh", "Shubra El-Kheima", "Port-Saïd", "Suez", "Louxor", "Assouan", "Mansourah", "Tanta"],
    "AE": ["Dubaï", "Abou Dabi", "Charjah", "Al Aïn", "Ajman", "Ras el Khaïmah", "Fujaïrah", "Oumm al Qaïwaïn", "Khor Fakkan", "Dibba"],
    "EC": ["Quito", "Guayaquil", "Cuenca", "Santo Domingo", "Machala", "Manta", "Portoviejo", "Ambato", "Riobamba", "Esmeraldas"],
    "ER": ["Asmara", "Keren", "Massawa", "Assab", "Mendefera", "Barentu", "Adi Keyh", "Dekemhare", "Ak'ordat", "Teseney"],
    "ES": ["Madrid", "Barcelone", "Valence", "Séville", "Saragosse", "Malaga", "Murcie", "Palma", "Bilbao", "Alicante"],
    "EE": ["Tallinn", "Tartu", "Narva", "Pärnu", "Kohtla-Järve", "Viljandi", "Rakvere", "Maardu", "Sillamäe", "Kuressaare"],
    "SZ": ["Mbabane", "Manzini", "Lobamba", "Siteki", "Nhlangano", "Piggs Peak", "Malkerns", "Big Bend", "Hlatsikulu", "Mhlume"],
    "US": ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphie", "San Antonio", "San Diego", "Dallas", "San José", "Washington"],
    "ET": ["Addis-Abeba", "Dire Dawa", "Mekele", "Gondar", "Adama", "Hawassa", "Bahir Dar", "Jimma", "Dessie", "Jijiga"],
    "FJ": ["Suva", "Lautoka", "Nadi", "Labasa", "Ba", "Levuka", "Savusavu", "Sigatoka", "Tavua", "Rakiraki"],
    "FI": ["Helsinki", "Espoo", "Tampere", "Vantaa", "Oulu", "Turku", "Jyväskylä", "Lahti", "Kuopio", "Pori"],
    "FR": ["Paris", "Marseille", "Lyon", "Toulouse", "Nice", "Nantes", "Montpellier", "Strasbourg", "Bordeaux", "Lille", "Rennes"],
    "GA": ["Libreville", "Port-Gentil", "Franceville", "Oyem", "Moanda", "Mouila", "Lambaréné", "Tchibanga", "Koulamoutou", "Makokou", "Bitam"],
    "GM": ["Banjul", "Serekunda", "Brikama", "Bakau", "Farafenni", "Lamin", "Sukuta", "Basse Santa Su", "Gunjur", "Soma"],
    "GE": ["Tbilissi", "Koutaïssi", "Batoumi", "Roustavi", "Gori", "Zougdidi", "Poti", "Khashuri", "Samtredia", "Senaki"],
    "GH": ["Accra", "Kumasi", "Tamale", "Takoradi", "Cape Coast", "Tema", "Sunyani", "Ho", "Koforidua", "Wa", "Techiman"],
    "GR": ["Athènes", "Thessalonique", "Patras", "Héraklion", "Larissa", "Volos", "Ioannina", "La Canée", "Chalcis", "Rhodes"],
    "GT": ["Guatemala", "Mixco", "Villa Nueva", "Quetzaltenango", "Escuintla", "San Juan Sacatepéquez", "Villa Canales", "Chinautla", "Chimaltenango", "Huehuetenango"],
    "GN": ["Conakry", "Nzérékoré", "Kankan", "Kindia", "Labé", "Mamou", "Guéckédou", "Kissidougou", "Boké", "Faranah"],
    "GW": ["Bissau", "Bafatá", "Gabú", "Bissorã", "Bolama", "Cacheu", "Catió", "Mansôa", "Buba", "Quinhamel"],
    "GQ": ["Malabo", "Bata", "Ebebiyín", "Mongomo", "Luba", "Evinayong", "Aconibe", "Añisoc", "Mikomeseng", "Nsok"],
    "GY": ["Georgetown", "Linden", "New Amsterdam", "Anna Regina", "Bartica", "Skeldon", "Rosignol", "Mahdia", "Lethem", "Mabaruma"],
    "HT": ["Port-au-Prince", "Cap-Haïtien", "Gonaïves", "Les Cayes", "Jacmel", "Léogâne", "Saint-Marc", "Port-de-Paix", "Jérémie", "Pétion-Ville"],
    "HN": ["Tegucigalpa", "San Pedro Sula", "Choloma", "La Ceiba", "El Progreso", "Choluteca", "Comayagua", "Puerto Cortés", "La Lima", "Danlí"],
    "HU": ["Budapest", "Debrecen", "Szeged", "Miskolc", "Pécs", "Győr", "Nyíregyháza", "Kecskemét", "Székesfehérvár", "Szombathely"],
    "IN": ["Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai", "Kolkata", "Pune", "Ahmedabad", "Jaipur", "Lucknow"],
    "ID": ["Jakarta", "Surabaya", "Bandung", "Medan", "Semarang", "Makassar", "Palembang", "Depok", "Tangerang", "Bekasi"],
    "IQ": ["Bagdad", "Bassorah", "Mossoul", "Erbil", "Kirkouk", "Nadjaf", "Kerbala", "Nasiriyah", "Amarah", "Souleimaniye"],
    "IR": ["Téhéran", "Mashhad", "Ispahan", "Karaj", "Tabriz", "Shiraz", "Ahvaz", "Qom", "Kermanshah", "Urmia"],
    "IE": ["Dublin", "Cork", "Limerick", "Galway", "Waterford", "Drogheda", "Dundalk", "Swords", "Bray", "Navan"],
    "IS": ["Reykjavik", "Kópavogur", "Hafnarfjörður", "Akureyri", "Reykjanesbær", "Garðabær", "Mosfellsbær", "Árborg", "Akranes", "Fjarðabyggð"],
    "IL": ["Jérusalem", "Tel Aviv", "Haïfa", "Rishon LeZion", "Petah Tikva", "Ashdod", "Netanya", "Beer-Sheva", "Holon", "Bnei Brak"],
    "IT": ["Rome", "Milan", "Naples", "Turin", "Palerme", "Gênes", "Bologne", "Florence", "Bari", "Catane"],
    "JM": ["Kingston", "Montego Bay", "Spanish Town", "Portmore", "Mandeville", "May Pen", "Old Harbour", "Savanna-la-Mar", "Ocho Rios", "Port Antonio"],
    "JP": ["Tokyo", "Yokohama", "Osaka", "Nagoya", "Sapporo", "Fukuoka", "Kobe", "Kyoto", "Kawasaki", "Saitama"],
    "JO": ["Amman", "Zarqa", "Irbid", "Russeifa", "Wadi al-Seer", "Aqaba", "Madaba", "Salt", "Mafraq", "Jerash"],
    "KZ": ["Almaty", "Astana", "Chimkent", "Karaganda", "Aktobe", "Taraz", "Pavlodar", "Semey", "Oust-Kamenogorsk", "Oral"],
    "KE": ["Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret", "Thika", "Malindi", "Kitale", "Garissa", "Kakamega"],
    "KG": ["Bichkek", "Och", "Jalal-Abad", "Karakol", "Tokmok", "Uzgen", "Balykchy", "Kara-Balta", "Naryn", "Talas"],
    "KW": ["Koweït", "Al Ahmadi", "Hawalli", "Salmiya", "Jahra", "Fahaheel", "Fintas", "Mahboula", "Sabah Al Salem", "Mangaf"],
    "LA": ["Vientiane", "Pakse", "Savannakhet", "Luang Prabang", "Thakhek", "Phonsavan", "Xam Neua", "Muang Xay", "Attapeu", "Pakse"],
    "LS": ["Maseru", "Teyateyaneng", "Mafeteng", "Hlotse", "Mohale's Hoek", "Qacha's Nek", "Quthing", "Butha-Buthe", "Mokhotlong", "Maputsoe"],
    "LV": ["Riga", "Daugavpils", "Liepaja", "Jelgava", "Jurmala", "Ventspils", "Rezekne", "Valmiera", "Jekabpils", "Ogre"],
    "LB": ["Beyrouth", "Tripoli", "Sidon", "Tyr", "Zahlé", "Jounieh", "Baalbek", "Byblos", "Nabatieh", "Batroun"],
    "LR": ["Monrovia", "Gbarnga", "Buchanan", "Kakata", "Harper", "Voinjama", "Zwedru", "Robertsport", "Sanniquellie", "Greenville"],
    "LY": ["Tripoli", "Benghazi", "Misrata", "Bayda", "Zawiya", "Zliten", "Ajdabiya", "Tobruk", "Sebha", "Derna"],
    "LI": ["Vaduz", "Schaan", "Balzers", "Triesen", "Eschen", "Mauren", "Triesenberg", "Ruggell", "Gamprin", "Schellenberg"],
    "LT": ["Vilnius", "Kaunas", "Klaipėda", "Šiauliai", "Panevėžys", "Alytus", "Marijampolė", "Mažeikiai", "Jonava", "Utena"],
    "LU": ["Luxembourg", "Esch-sur-Alzette", "Differdange", "Dudelange", "Ettelbruck", "Diekirch", "Wiltz", "Echternach", "Rumelange", "Grevenmacher"],
    "MK": ["Skopje", "Bitola", "Kumanovo", "Prilep", "Tetovo", "Veles", "Ochrid", "Gostivar", "Štip", "Strumica"],
    "MG": ["Antananarivo", "Toamasina", "Antsirabe", "Fianarantsoa", "Mahajanga", "Toliara", "Antsiranana", "Ambovombe", "Ambatondrazaka", "Morondava"],
    "MY": ["Kuala Lumpur", "George Town", "Johor Bahru", "Ipoh", "Shah Alam", "Petaling Jaya", "Kota Kinabalu", "Kuching", "Malacca", "Alor Setar"],
    "MW": ["Lilongwe", "Blantyre", "Mzuzu", "Zomba", "Kasungu", "Mangochi", "Karonga", "Salima", "Nkhotakota", "Dedza"],
    "MV": ["Malé", "Addu", "Fuvahmulah", "Kulhudhuffushi", "Thinadhoo", "Ungoofaaru", "Funadhoo", "Naifaru", "Mahibadhoo", "Eydhafushi"],
    "ML": ["Bamako", "Sikasso", "Ségou", "Mopti", "Koutiala", "Kayes", "Gao", "Markala", "Kati", "San", "Tombouctou"],
    "MT": ["La Valette", "Birkirkara", "Mosta", "Qormi", "Żabbar", "Sliema", "San Ġwann", "Naxxar", "Rabat", "Żejtun"],
    "MA": ["Casablanca", "Rabat", "Fès", "Marrakech", "Tanger", "Agadir", "Meknès", "Oujda", "Kénitra", "Tétouan", "Safi"],
    "MU": ["Port-Louis", "Beau Bassin-Rose Hill", "Vacoas-Phoenix", "Curepipe", "Quatre Bornes", "Triolet", "Goodlands", "Centre de Flacq", "Mahébourg", "Saint-Pierre"],
    "MR": ["Nouakchott", "Nouadhibou", "Kiffa", "Kaédi", "Zouerate", "Rosso", "Atar", "Néma", "Aleg", "Sélibaby"],
    "MX": ["Mexico", "Guadalajara", "Monterrey", "Puebla", "Tijuana", "León", "Juárez", "Zapopan", "Mérida", "Cancún"],
    "MD": ["Chișinău", "Tiraspol", "Bălți", "Bender", "Rîbnița", "Cahul", "Ungheni", "Soroca", "Orhei", "Comrat"],
    "MC": ["Monaco-Ville", "Monte-Carlo", "La Condamine", "Fontvieille", "Larvotto", "Moneghetti", "La Rousse", "Saint-Roman", "Les Révoires", "Jardin Exotique"],
    "MN": ["Oulan-Bator", "Erdenet", "Darkhan", "Choibalsan", "Mörön", "Nalaikh", "Khovd", "Ölgii", "Ulaangom", "Bayankhongor"],
    "ME": ["Podgorica", "Nikšić", "Pljevlja", "Bijelo Polje", "Cetinje", "Bar", "Herceg Novi", "Berane", "Budva", "Ulcinj"],
    "MZ": ["Maputo", "Matola", "Nampula", "Beira", "Chimoio", "Nacala", "Quelimane", "Tete", "Lichinga", "Pemba"],
    "NA": ["Windhoek", "Walvis Bay", "Swakopmund", "Rundu", "Oshakati", "Katima Mulilo", "Otjiwarongo", "Grootfontein", "Rehoboth", "Keetmanshoop"],
    "NP": ["Katmandou", "Pokhara", "Lalitpur", "Bharatpur", "Biratnagar", "Birgunj", "Dharan", "Butwal", "Hetauda", "Nepalgunj"],
    "NI": ["Managua", "León", "Masaya", "Tipitapa", "Chinandega", "Matagalpa", "Estelí", "Granada", "Ciudad Sandino", "Juigalpa"],
    "NE": ["Niamey", "Zinder", "Maradi", "Agadez", "Tahoua", "Dosso", "Arlit", "Tillabéri", "Diffa", "Birni N'Konni"],
    "NG": ["Lagos", "Abuja", "Kano", "Ibadan", "Port Harcourt", "Benin City", "Kaduna", "Enugu", "Onitsha", "Maiduguri", "Aba"],
    "NO": ["Oslo", "Bergen", "Trondheim", "Stavanger", "Drammen", "Fredrikstad", "Kristiansand", "Sandnes", "Tromsø", "Sarpsborg"],
    "NZ": ["Auckland", "Wellington", "Christchurch", "Hamilton", "Tauranga", "Napier-Hastings", "Dunedin", "Palmerston North", "Nelson", "Rotorua"],
    "OM": ["Mascate", "Salalah", "Sohar", "Nizwa", "Sur", "Ibri", "Saham", "Barka", "Rustaq", "Khasab"],
    "UG": ["Kampala", "Gulu", "Lira", "Mbarara", "Jinja", "Mbale", "Mukono", "Kasese", "Masaka", "Entebbe"],
    "UZ": ["Tachkent", "Samarcande", "Namangan", "Andijan", "Boukhara", "Nukus", "Qarshi", "Fergana", "Kokand", "Termez"],
    "PK": ["Karachi", "Lahore", "Islamabad", "Faisalabad", "Rawalpindi", "Multan", "Peshawar", "Quetta", "Hyderabad", "Gujranwala"],
    "PS": ["Gaza", "Hébron", "Naploue", "Jénine", "Ramallah", "Bethléem", "Tulkarem", "Qalqilya", "Jéricho", "Khan Younès"],
    "PA": ["Panama", "San Miguelito", "Colón", "David", "La Chorrera", "Santiago", "Chitré", "Penonomé", "Changuinola", "Puerto Armuelles"],
    "PG": ["Port Moresby", "Lae", "Mount Hagen", "Madang", "Goroka", "Kokopo", "Kimbe", "Wewak", "Alotau", "Mendi"],
    "PY": ["Asunción", "Ciudad del Este", "San Lorenzo", "Luque", "Capiatá", "Lambaré", "Fernando de la Mora", "Encarnación", "Pedro Juan Caballero", "Coronel Oviedo"],
    "NL": ["Amsterdam", "Rotterdam", "La Haye", "Utrecht", "Eindhoven", "Groningue", "Tilburg", "Almere", "Breda", "Nimègue"],
    "PE": ["Lima", "Arequipa", "Trujillo", "Chiclayo", "Piura", "Cusco", "Iquitos", "Huancayo", "Chimbote", "Pucallpa"],
    "PH": ["Manille", "Quezon City", "Davao", "Cebu", "Zamboanga", "Antipolo", "Pasig", "Cagayan de Oro", "Parañaque", "Caloocan"],
    "PL": ["Varsovie", "Cracovie", "Łódź", "Wrocław", "Poznań", "Gdańsk", "Szczecin", "Bydgoszcz", "Lublin", "Katowice"],
    "PT": ["Lisbonne", "Porto", "Braga", "Coimbra", "Funchal", "Setúbal", "Amadora", "Queluz", "Almada", "Évora"],
    "QA": ["Doha", "Al Rayyan", "Al Wakrah", "Al Khor", "Dukhan", "Umm Salal", "Al Shamal", "Mesaieed", "Lusail", "Al Daayen"],
    "CF": ["Bangui", "Bimbo", "Berbérati", "Carnot", "Bambari", "Bouar", "Bossangoa", "Bria", "Bangassou", "Nola"],
    "DO": ["Saint-Domingue", "Santiago de los Caballeros", "Santo Domingo Este", "San Pedro de Macorís", "La Romana", "San Cristóbal", "Puerto Plata", "San Francisco de Macorís", "La Vega", "Punta Cana"],
    "CZ": ["Prague", "Brno", "Ostrava", "Pilsen", "Liberec", "Olomouc", "České Budějovice", "Hradec Králové", "Ústí nad Labem", "Pardubice"],
    "RO": ["Bucarest", "Cluj-Napoca", "Timișoara", "Iași", "Constanța", "Craiova", "Brașov", "Galați", "Ploiești", "Oradea"],
    "GB": ["Londres", "Birmingham", "Manchester", "Glasgow", "Liverpool", "Leeds", "Édimbourg", "Bristol", "Sheffield", "Cardiff"],
    "RU": ["Moscou", "Saint-Pétersbourg", "Novossibirsk", "Iekaterinbourg", "Kazan", "Nijni Novgorod", "Tcheliabinsk", "Samara", "Omsk", "Rostov-sur-le-Don"],
    "RW": ["Kigali", "Butare", "Gisenyi", "Ruhengeri", "Byumba", "Cyangugu", "Kibuye", "Rwamagana", "Nyagatare", "Muhanga"],
    "SM": ["Saint-Marin", "Serravalle", "Borgo Maggiore", "Domagnano", "Fiorentino", "Acquaviva", "Faetano", "Chiesanuova", "Montegiardino", "Dogana"],
    "SV": ["San Salvador", "Santa Ana", "Soyapango", "San Miguel", "Mejicanos", "Santa Tecla", "Apopa", "Delgado", "Ahuachapán", "Ilopango"],
    "SN": ["Dakar", "Thiès", "Rufisque", "Kaolack", "Saint-Louis", "Ziguinchor", "Touba", "Mbour", "Diourbel", "Louga", "Tambacounda"],
    "RS": ["Belgrade", "Novi Sad", "Niš", "Kragujevac", "Subotica", "Zrenjanin", "Pančevo", "Čačak", "Novi Pazar", "Kraljevo"],
    "SC": ["Victoria", "Anse Boileau", "Beau Vallon", "Takamaka", "Anse Royale", "Bel Ombre", "Cascade", "Grand Anse", "La Digue", "Praslin"],
    "SL": ["Freetown", "Bo", "Kenema", "Makeni", "Koidu", "Lunsar", "Port Loko", "Waterloo", "Kabala", "Magburaka"],
    "SG": ["Singapour Centre", "Jurong", "Tampines", "Woodlands", "Yishun", "Bedok", "Hougang", "Ang Mo Kio", "Punggol", "Clementi"],
    "SK": ["Bratislava", "Košice", "Prešov", "Žilina", "Nitra", "Banská Bystrica", "Trnava", "Martin", "Trenčín", "Poprad"],
    "SI": ["Ljubljana", "Maribor", "Celje", "Kranj", "Velenje", "Koper", "Novo Mesto", "Ptuj", "Trbovlje", "Kamnik"],
    "SO": ["Mogadiscio", "Hargeisa", "Bosaso", "Kismayo", "Baidoa", "Beledweyne", "Garoowe", "Berbera", "Merca", "Galkayo"],
    "SD": ["Khartoum", "Omdurman", "Khartoum Nord", "Port-Soudan", "Kassala", "Nyala", "El-Obeid", "Wad Madani", "Gedaref", "Atbara"],
    "SS": ["Djouba", "Malakal", "Wau", "Yei", "Aweil", "Bentiu", "Bor", "Rumbek", "Torit", "Yambio"],
    "LK": ["Colombo", "Dehiwala", "Moratuwa", "Jaffna", "Negombo", "Kandy", "Kalmunai", "Galle", "Trincomalee", "Batticaloa"],
    "SE": ["Stockholm", "Göteborg", "Malmö", "Uppsala", "Västerås", "Örebro", "Linköping", "Helsingborg", "Jönköping", "Norrköping"],
    "CH": ["Zurich", "Genève", "Bâle", "Lausanne", "Berne", "Winterthour", "Lucerne", "Saint-Gall", "Lugano", "Bienne"],
    "SR": ["Paramaribo", "Lelydorp", "Nieuw Nickerie", "Moengo", "Nieuw Amsterdam", "Mariënburg", "Wageningen", "Albina", "Groningen", "Brokopondo"],
    "SY": ["Damas", "Alep", "Homs", "Hama", "Lattaquié", "Deir ez-Zor", "Raqqa", "Tartous", "Idleb", "Daraa"],
    "TJ": ["Douchanbé", "Khodjent", "Kulob", "Bokhtar", "Istaravshan", "Konibodom", "Tursunzoda", "Isfara", "Panjakent", "Vahdat"],
    "TZ": ["Dar es Salaam", "Dodoma", "Mwanza", "Arusha", "Mbeya", "Morogoro", "Tanga", "Zanzibar", "Kigoma", "Moshi"],
    "TD": ["N'Djaména", "Moundou", "Sarh", "Abéché", "Kelo", "Koumra", "Pala", "Am Timan", "Bongor", "Doba"],
    "TH": ["Bangkok", "Nonthaburi", "Pak Kret", "Hat Yai", "Chiang Mai", "Udon Thani", "Khon Kaen", "Nakhon Ratchasima", "Pattaya", "Phuket"],
    "TL": ["Dili", "Baucau", "Maliana", "Suai", "Lospalos", "Same", "Aileu", "Liquiçá", "Manatuto", "Viqueque"],
    "TG": ["Lomé", "Sokodé", "Kara", "Kpalimé", "Atakpamé", "Dapaong", "Tsévié", "Aného", "Mango", "Bassar"],
    "TT": ["Port of Spain", "San Fernando", "Chaguanas", "Arima", "Point Fortin", "Scarborough", "Tunapuna", "Sangre Grande", "Princes Town", "Couva"],
    "TN": ["Tunis", "Sfax", "Sousse", "Ettadhamen", "Kairouan", "Bizerte", "Gabès", "Ariana", "Gafsa", "Monastir", "Nabeul"],
    "TM": ["Achgabat", "Türkmenabat", "Dashoguz", "Mary", "Balkanabat", "Bayramaly", "Türkmenbaşy", "Tejen", "Abadan", "Yolöten"],
    "TR": ["Istanbul", "Ankara", "Izmir", "Bursa", "Adana", "Gaziantep", "Konya", "Antalya", "Kayseri", "Mersin"],
    "UA": ["Kiev", "Kharkiv", "Odessa", "Dnipro", "Donetsk", "Lviv", "Zaporijjia", "Kryvyï Rih", "Mykolaïv", "Marioupol"],
    "UY": ["Montevideo", "Salto", "Paysandú", "Las Piedras", "Rivera", "Maldonado", "Tacuarembó", "Melo", "Mercedes", "Artigas"],
    "VU": ["Port-Vila", "Luganville", "Norsup", "Isangel", "Sola", "Lakatoro", "Lenakel", "Longana", "Sarami", "Craig Cove"],
    "VA": ["Cité du Vatican", "Place Saint-Pierre", "Musées du Vatican", "Jardins du Vatican", "Borgo", "Prati", "Trastevere", "Esquilino", "Campo Marzio", "Ponte"],
    "VE": ["Caracas", "Maracaibo", "Valencia", "Barquisimeto", "Maracay", "Ciudad Guayana", "Barcelona", "Maturín", "San Cristóbal", "Ciudad Bolívar"],
    "VN": ["Hanoï", "Hô Chi Minh-Ville", "Da Nang", "Haiphong", "Cần Thơ", "Biên Hòa", "Nha Trang", "Hué", "Vũng Tàu", "Qui Nhon"],
    "YE": ["Sanaa", "Aden", "Taëz", "Hodeïda", "Ibb", "Mukalla", "Dhamar", "Amran", "Say'un", "Zinjibar"],
    "ZM": ["Lusaka", "Kitwe", "Ndola", "Kabwe", "Chingola", "Mufulira", "Livingstone", "Luanshya", "Kasama", "Chipata"],
    "ZW": ["Harare", "Bulawayo", "Chitungwiza", "Mutare", "Gweru", "Kwekwe", "Kadoma", "Masvingo", "Chinhoyi", "Marondera"],
}

# Fix Laos duplicate Pakse
CITIES["LA"] = ["Vientiane", "Pakse", "Savannakhet", "Luang Prabang", "Thakhek", "Phonsavan", "Xam Neua", "Muang Xay", "Attapeu", "Luang Namtha"]

ISOS = [
    "AF","ZA","AL","DZ","DE","AD","AO","SA","AR","AM","AU","AT","AZ","BS","BH","BD","BE","BJ","BT","BY",
    "MM","BO","BA","BW","BR","BN","BG","BF","BI","KH","CM","CA","CV","CL","CN","CY","CO","KM","CG","CD",
    "KP","KR","CR","CI","HR","CU","DK","DJ","DM","EG","AE","EC","ER","ES","EE","SZ","US","ET","FJ","FI",
    "FR","GA","GM","GE","GH","GR","GT","GN","GW","GQ","GY","HT","HN","HU","IN","ID","IQ","IR","IE","IS",
    "IL","IT","JM","JP","JO","KZ","KE","KG","KW","LA","LS","LV","LB","LR","LY","LI","LT","LU","MK","MG",
    "MY","MW","MV","ML","MT","MA","MU","MR","MX","MD","MC","MN","ME","MZ","NA","NP","NI","NE","NG","NO",
    "NZ","OM","UG","UZ","PK","PS","PA","PG","PY","NL","PE","PH","PL","PT","QA","CF","DO","CZ","RO","GB",
    "RU","RW","SM","SV","SN","RS","SC","SL","SG","SK","SI","SO","SD","SS","LK","SE","CH","SR","SY","TJ",
    "TZ","TD","TH","TL","TG","TT","TN","TM","TR","UA","UY","VU","VA","VE","VN","YE","ZM","ZW",
]


def main() -> None:
    missing = [i for i in ISOS if i not in CITIES]
    short = [i for i, v in CITIES.items() if len(set(v)) < 10]
    extra = [i for i in CITIES if i not in ISOS]
    if missing or short or extra:
        raise SystemExit(f"missing={missing} short={short} extra={extra}")
    lines = [
        "export const CITIES: Record<string, string[]> = {",
    ]
    for iso in ISOS:
        cities = CITIES[iso]
        # unique preserve order
        seen: set[str] = set()
        uniq: list[str] = []
        for c in cities:
            if c not in seen:
                seen.add(c)
                uniq.append(c)
        joined = ", ".join(f'"{c}"' for c in uniq)
        lines.append(f"  {iso}: [{joined}],")
    lines.append("};")
    lines.append("")
    lines.append("export function citiesFor(iso?: string | null): string[] {")
    lines.append('  if (!iso || iso === "ALL") return [];')
    lines.append("  return CITIES[iso.toUpperCase()] || [];")
    lines.append("}")
    lines.append("")
    out = Path(__file__).resolve().parents[1] / "src" / "cities.ts"
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    src = Path(__file__).resolve().parents[1] / "src" / "countries.ts"
    listed = re.findall(r'iso: "([A-Z]{2})"', src.read_text(encoding="utf-8"))
    miss = [i for i in listed if i not in CITIES]
    print(f"wrote {out} countries={len(ISOS)} min={min(len(set(CITIES[i])) for i in ISOS)} missing_from_countries={miss}")


if __name__ == "__main__":
    main()
