// TODO - set up area calculations for classes

// Data details
var dataByID = [];
var dataDomain = [];
var rawData;
var rawMapData;
var attribute = "rate" // which field in the tsv to map

// Classification details
var numberOfClasses = 5;
var classScheme = "EqualInterval";
var colorScheme = "GnBu";
var classBreaks = []; 
var extendedClassBreaks = []; // for splitting bars in histogram
var numberClassDivisions = 1; // split bars in histogram into finer segments within each class

/////////////////********************//////////////////

queue()
	.defer(d3.tsv, "data/all_data.tsv")
    .defer(d3.json, "data/us.json") // map data
    .await(ready);

function ready(error, mapAtts, mapData){
	var valueDomain = []; // Numeric values only
	var rateByID = [];

	console.log("Initializing data and view...");
	console.log("Working with the attribute: " + attribute);
	console.log("Other available attributes are: ");
	print_attribute_keys(mapAtts);

	rawMapData = mapData;
	rawData = mapAtts; 
	set_value_domain(rawData);

	draw_counties(mapData);
	draw_dots(mapData);

	classBreaks = get_class_breaks();
	draw_histogram(get_class_counts()); // no color scheme...

	d3.select('.colorScheme').on('change', function() {
		set_color_scheme(this.value);
	})
	d3.select('.numberClasses').on('change', function(){
		set_number_breaks(parseInt(this.value));
	})
	d3.select('.classScheme').on('change', function(){
		set_classification_scheme(this.value);
	})
	d3.select('.fieldSelect').on('change', function(){
		set_attribute(this.value);
	})
}

/////////////////********************//////////////////
function draw_counties(mapData){
	console.log("Drawing county outlines...")
	//draw counties
	var width = 800,
	    height = 500;
	    
	var projection = d3.geo.albersUsa()
	    .scale(800)
	    .translate([width / 2, height / 2]);

	var path = d3.geo.path()
	    .projection(projection);

	var svg = d3.select(".map").append("svg")
	    .attr("width", width)
	    .attr("height", height);

	counties = svg.append("g")
	  .attr("class", "counties")
	  .selectAll("path")
	  .data(topojson.feature(mapData, mapData.objects.counties).features)
	  .enter().append("path")
	  .attr("d", path)
	  .attr("id", function(d){
	  	return d.id;
	  } ); // Tack on the FIPS code as an ID

	svg.append("path")
	  .datum(topojson.mesh(mapData, mapData.objects.states, function(a, b) { return a !== b; }))
	  .attr("class", "states")
	  .attr("d", path);

// color polygons
    set_fill_single_color("counties");

    return counties;
}

function draw_dots(mapData){
//if it already exists, remove the svg and re-draw
	d3.select(".dots").select("svg").remove();

	var dataMin = Math.min.apply(Math, dataDomain),
		dataMax = Math.max.apply(Math, dataDomain);

	console.log("Drawing dots...");

	var height = 500;
	var dotSvg = d3.select(".dots").append("svg")
	    .attr("width", 20)
	    .attr("height", height)
	    .attr("class", "dotSvg");
	
	dots = dotSvg.append("g")
	  .selectAll("circle")
	  .data(topojson.feature(rawMapData, rawMapData.objects.counties).features)
	  .enter().append("circle")
	  .attr("r", function(d){
	  		if (dataByID[d.id]){ // To remove the PR and USVI values that aren't showing on the map
		  		return 2;
	  		}
	  	})
	  .attr("cx", 5)
	  .attr("cy", function(d){
	  		if (dataByID[d.id]){
		  		return scale_one_dot(height, dataByID[d.id], dataMax, dataMin);
	  	}
	  })
	  .attr("id", function(d){return d.id})
	  .attr("class", "dots");

	  set_fill_single_color("dots");

	  return dots;
}

function draw_histogram(classCounts, colorScheme){
	colorScheme = colorScheme || "null"
//if it already exists, remove the svg and re-draw
	d3.select(".histogram").select("svg").remove();

	var svgWidth = 170,
		svgHeight = 100,
		margins = {top: 5, bottom: 5, left: 5, right: 5},
		histWidth = svgWidth - margins.left - margins.right,
		histHeight = svgHeight - margins.top - margins.bottom;

	// Set scale for width of histogram
	var x = d3.scale.linear()
	  	.domain([classBreaks[0], classBreaks[c.length-1]]) //range should be first and last elements in array
	  	.range([0, histWidth]);

	// Set scale for height of histogram (based on max count)
	var y = d3.scale.linear()
		.domain([0, Math.max.apply(Math, classCounts)])
		.range([0, histHeight]);

	// Generate a histogram using one bin per class.
	var barSvg = d3.select(".histogram").append("svg")
	  .attr("width", svgWidth)
	  .attr("height", svgHeight)
	  .append("g")
	  .attr("transform", "translate(" + margins.left + "," + margins.top + ")");

	var bar = barSvg.selectAll(".bar")
	  .data(classCounts)
	  .enter().append("g")
	  .attr("class", "bar");

	bar.append("rect")
	  .attr("x", function(d,i){
	  	return x(extendedClassBreaks[i]);
	  })
	  .attr("y", function(d, i){
	  	return histHeight - y(classCounts[i]);
	  }) // y location should be count of entities
	  .attr("width", function(d,i){
	  	return x(extendedClassBreaks[0] + extendedClassBreaks[i+1] - extendedClassBreaks[i])
	  }) // scaled range based on class values
	  .attr("height", function(d, i) { return y(classCounts[i]); })
	  .attr("class", function(d, i){
	  	if (colorScheme == "null"){
	  		return "bars"
	  	} else {
	  	return "bars " + colorScheme + "q" + parseInt(i/numberClassDivisions) + "-" + (classBreaks.length-1);
	  }
	  }); 

	barSvg.append("g")
	  .attr("class", "x axis")
	  .attr("transform", "translate(0," + histHeight + ")");

	  if (colorScheme == "null"){
	  	set_fill_single_color("bars");
	  }
	return bar;  
}

/////////////////********************//////////////////

// Input: Object containing data key:value pairs
// Output: Print the array of available keys (field names)
function print_attribute_keys(o){
	var keyList = [];
	for (var k in o[0]){
		keyList.push(k);
	}
	console.log(keyList);
}

// Input: 
// Output: Pretty print the classes and range of values
function print_class_breaks(){
	for (var i=0; i < classBreaks.length -1; i++){
		console.log("class " + (i + 1) + " : " + classBreaks[i].toFixed(2) + " - " + classBreaks[i+1].toFixed(2));
	}
}

// Input: 
// Output: None - just sets the style for the counties to designated fill color based on attribute
function classify_map_and_legend(){
    counties.style("fill", null)
        .attr("class", function(d){
	        var cl = get_class(dataByID[d.id], c) - 1;
	        return "counties " +  colorScheme + "q" + cl + "-" + (classBreaks.length-1);
        }); 

    draw_dots(rawMapData);
    dots.style("fill", null)
        .attr("class", function(d){
        	var cl = get_class(dataByID[d.id], c) - 1;
        	return "dots " +  colorScheme + "q" + cl + "-" + (classBreaks.length-1);
        }); 
}

// Input: maximum height (from SVG), data value, and max/min values for the entire dataset to set the range
// Output: scaled height value in pixels
function scale_one_dot(height, value, dataMax, dataMin){
	return(height * ((value - dataMin) / (dataMax - dataMin)));
}

// Input: Single data value 
// Output: Class number that the value falls into (from 1 to n)
function get_class(value){
	for (var i=1; i < classBreaks.length - 1; i++){ // breaks[0] = dataMin
		if (value < classBreaks[i]) {
			return i;
		}
	}
	return classBreaks.length - 1;
}

function get_class_extended(value, breaks){
	//console.log(breaks.length);
	for (var i=1; i < breaks.length - 1; i++){ // breaks[0] = dataMin
		if (value < breaks[i]) {
			return i;
		}
	}
	return breaks.length - 1;
}

// Input:  
// Output: array listing the number of data values per class
function get_class_counts(){
	var classCounts = [];
	var extendedClasses = [];

	// set up container for counts of each class
	for (var i = 0; i < (classBreaks.length-1) * numberClassDivisions; i++){
		classCounts[i] = 0;
	}

	// get breaks for sub-classes (when binsPerClass > 1)
	//if (numberClassDivisions > 1){
		// create new breaks in-between
		for (var i = 0; i < classBreaks.length-1; i++){
			var binSlice = (classBreaks[i+1] - classBreaks[i]) / numberClassDivisions;
			for (var j = 0; j < numberClassDivisions; j++){
				extendedClasses.push(classBreaks[i] + j*binSlice)
			}
		}
	extendedClasses.push(classBreaks[classBreaks.length-1]);
	//console.log("Bins greater than 1", extendedClasses);
	
	// classify and count
	for (var i = 0; i < dataDomain.length; i++){
		var cl = get_class_extended(dataDomain[i], extendedClasses) - 1;	
		classCounts[cl] += 1;	
	}
	extendedClassBreaks = extendedClasses;
	return classCounts;
	
}

// Input: 
// Output: array of class breaks (c) - length of number of classes + 1 (min value, class1 high value, class2 high value... classN high value)
function get_class_breaks(){
	console.log("Setting class breaks...");

	if (numberOfClasses <= 2 || numberOfClasses >= 10){
		alert("You must select between 3 and 9 classes.");
		return;
	}
// setup for using the geostats.js library for classification
	gsData = new geostats(dataDomain);

// grab classbreaks using geostats.js library
	switch(classScheme){
		case "Jenks":
			c = gsData.getClassJenks(numberOfClasses);
			//c = ss.jenks(dataDomain, numberOfClasses);  // tried using script from simple_statistics (copied at end) but it also choked.
			break;
		case "EqualInterval":
			c = gsData.getClassEqInterval(numberOfClasses);
			break;
		case "Quantile":
			c = gsData.getClassQuantile(numberOfClasses);
			break;		
		case "Geometric":
			c = gsData.getClassGeometricProgression(numberOfClasses);
			break;
		default:
			alert("Unknown classification scheme selected\n[Jenks, EqualInterval, Quantile, Geometric]")
			return;
	}
	return c;
}

// Input: 
// Output: None - just triggers the classification of the counties, histogram, and dots
function classify(){
	classBreaks = get_class_breaks();
	if(classBreaks){
		console.log("Classifying data (" + attribute + ") using " + classScheme + " with " + numberOfClasses + " class breaks");
		classify_map_and_legend();
		draw_histogram(get_class_counts(), colorScheme);

		print_class_breaks();
	}
}

function set_value_domain(mapAtts){
	dataByID = [];
	dataDomain = [];

	mapAtts.forEach(function(d, i) { 
	    dataByID[d.id] = +parseFloat(d[attribute]); // value and FIPS code
	    if (d[attribute]){	    
	    	dataDomain.push(parseFloat(d[attribute]));	//removing the "" null values to make classification work cleanly
	    }
	  });
}

// Input: String for CSS class that is being re-colored; optional fill color in hex
// Output: None - just sets the style for the class to the designated fill color
function set_fill_single_color(obj, fillColor){
	fillColor = fillColor || "#225EA8"
	console.log("Setting " + obj + " to one color of " + fillColor);
	// can input hex or rgb as "rgb(34,94,168)"
	d3.selectAll("." + obj).style("fill", fillColor);
}

function set_number_breaks(n){
	numberOfClasses = n;
	classify();
}

function set_classification_scheme(scheme){
	classScheme = scheme;
	classify();
}

function set_color_scheme(scheme){
	colorScheme = scheme;
	classify();
}

function set_attribute(field){
	attribute = field;
	set_value_domain(rawData);
	classify();
}

function set_histogram_divisions(n){
	numberClassDivisions = n;
	classify();
}
