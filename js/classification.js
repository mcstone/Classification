// TODO - add tooltip to histogram - currently just logs to console
// TODO - make this way more efficient...

// Data details
var dataByID = {}; // associative array (use FIPS as key)
var dataDomain = [];
var rawData;
var rawMapData;
var attribute = "rate"; // which field in the tsv to map
var histoType = "count"; // to toggle area and count based histograms

// Classification details - defaults
var numberOfClasses = 5;  // no classification scheme set; no breaks set
var classScheme = "EqualInterval"; // no classification scheme set
var colorScheme = "YlGnBu"; // no color scheme set; map is one color
var classBreaks = [];
var extendedClassBreaks = []; // for splitting bars in histogram
var numberClassDivisions = 1; // split bars in histogram into finer segments within each class
var fillColor = "#666";
var lowOutlierThreshold, highOutlierThreshold;

/////////////////********************//////////////////
queue()
    .defer(d3.tsv, "data/all_data_noAKHI.tsv")
    .defer(d3.json, "data/us_noAKHI.json") // map data
    .await(ready);

function ready(error, mapAtts, mapData) {
    //Set all drop downs to defaults
    document.getElementById("numberClasses").selectedIndex = 2;
    document.getElementById("classScheme").selectedIndex = 0;
    document.getElementById("colorScheme").selectedIndex = 0;

    console.log("Initializing data and view...");
    console.log("Working with the attribute: " + attribute);
    console.log("Other available attributes are: ");
    print_attribute_keys(mapAtts);

    rawMapData = mapData;
    rawData = mapAtts;
    set_value_domain(rawData);
    classBreaks = get_class_breaks(classScheme, numberOfClasses, dataDomain);

    draw_counties(mapData);
    classify_map();

    draw_dots(mapData);
    classify_dots();

    if(histoType=="area"){
        draw_histogram(get_area_totals(), colorScheme);
    } else {
        draw_histogram(get_class_counts(), colorScheme);
    }

    draw_boxplot();

    d3.select('.colorScheme').on('change', function () {
        set_color_scheme(this.value);
    });
    d3.select('.numberClasses').on('change', function () {
        set_number_breaks(parseInt(this.value));
    });
    d3.select('.classScheme').on('change', function () {
        set_classification_scheme(this.value);
    });
    d3.select('.fieldSelect').on('change', function () {
        set_attribute(this.value);
    });
    d3.select('.histogramType').on('change', function () {
        set_histogram_type(this.value);
    });

}

/////////////////********************//////////////////
function draw_counties(mapData) {
    console.log("Drawing county outlines...");
    //draw counties
    var w = d3.select(".map").style("width");
    var h = d3.select(".map").style("height");

    var width = w.substring(0, w.length - 2),
        height = h.substring(0, h.length - 2);

    var projection = d3.geo.albersUsa()
        .scale(800)
        .translate([width / 2, height / 2]);

    var path = d3.geo.path()
        .projection(projection);

    var mapDiv = d3.select(".map").append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);  // start out invisible

    var svg = d3.select(".map").append("svg")
        .attr("width", width)
        .attr("height", height);

    counties = svg.append("g")
        .attr("class", "counties")
        .selectAll("path")
        .data(topojson.feature(mapData, mapData.objects.counties).features)
        .enter().append("path")
        .attr("d", path)
        .attr("id", function (d) {
            return "_" + d.id;
        })
        .on("mouseover", function (d) {
            d3.select(this).transition().duration(50).style("opacity", 0.5);
            d3.select(".dots").select("#_" + d.id).style("opacity", 0.5);
            mapDiv.transition().duration(50).style("opacity", 1);
            mapDiv.html("<b>FIPS Code:</b> " + d.id + "<br/><b>" + attribute + ":</b> " + dataByID[d.id])
                .style("left", (d3.event.pageX + 10) + "px")
                .style("top", (d3.event.pageY - 30) + "px");

            d3.select(".dotLine").transition().duration(100)
                .attr("y1", scale_one_dot(height, dataByID[d.id], Math.max.apply(Math, dataDomain), Math.min.apply(Math, dataDomain)))
                .attr("y2", scale_one_dot(height, dataByID[d.id], Math.max.apply(Math, dataDomain), Math.min.apply(Math, dataDomain)));
        })
        .on("mouseout", function (d) {
            d3.select(this)
                .transition().duration(50).style("opacity", 1);
            d3.select(".dots").select("#_" + d.id).style("opacity", 1);
            mapDiv.transition().duration(200).style("opacity", 0);
        });

    var states = svg.append("path")
        .datum(topojson.mesh(mapData, mapData.objects.states, function (a, b) {
            return a !== b;
        }))
        .attr("class", "states")
        .attr("d", path);

    return counties;
}

function draw_dots(mapData) {
//if it already exists, remove the svg and re-draw - should only happen when the dataset changes
    d3.select(".dots").select("svg").remove();

    var dataMin = Math.min.apply(Math, dataDomain),
        dataMax = Math.max.apply(Math, dataDomain);

    console.log("Drawing dots...");
    var w = d3.select(".dots").style("width");
    var h = d3.select(".dots").style("height");

    var width = w.substring(0, w.length - 2),
        height = h.substring(0, h.length - 2);

    var dotSvg = d3.select(".dots").append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("class", "dotSvg");

    var dotDiv = d3.select(".dots").append("div")
        .attr("class", "tooltip")
        .style("opacity", 0)
        .style("width", "100px");

    dots = dotSvg.append("g")
        .selectAll("circle")
        .data(topojson.feature(rawMapData, rawMapData.objects.counties).features)
        .enter().append("circle")
        .attr("r", function (d) {
            if (dataByID[d.id]) { // To remove the PR and USVI values that aren't showing on the map
                return 3;
            }
        })
        .attr("cx", width/2)
        .attr("cy", function (d) {
            if (dataByID[d.id]) {
                return scale_one_dot(height, dataByID[d.id], dataMax, dataMin);
            }
        })
        .attr("id", function (d) {
            return ("_" + d.id)
        })
        .attr("class", "dots")
        .on("mouseover", function (d) {
            d3.select(".counties").select("#_" + d.id).style("opacity", 0.5);
            dotDiv.transition().duration(50).style("opacity", 1);
            dotDiv.html("<b>FIPS Code:</b> " + d.id + "<br/><b>" + attribute + ":</b> " + dataByID[d.id])
                .style("left", (d3.event.pageX + 5) + "px")
                .style("top", (d3.event.pageY - 30) + "px");
        })
        .on("mouseout", function (d) {
            d3.select(this).transition().duration(50).style("opacity", 1);
            d3.select(".counties").select("#_" + d.id).style("opacity", 1);
            dotDiv.transition().duration(300).style("opacity", 0);
        });

    // draw bar on dots for "currently selected" on map
    selectedLine = dotSvg.append("line")
        .attr("x1", 0)
        .attr("y1", scale_one_dot(height, dataMin, dataMax, dataMin))
        .attr("x2", width)
        .attr("y2", scale_one_dot(height, dataMin, dataMax, dataMin))
        .attr("class", "dotLine");

    return dots;
}

function draw_histogram(classCounts, colorScheme) {
//if it already exists, remove the svg and re-draw
    d3.select(".histogram").select("svg").remove();

    var w = d3.select(".histogram").style("width");
    var h = d3.select(".histogram").style("height");

    var svgWidth = w.substring(0, w.length - 2),
        svgHeight = h.substring(0, h.length - 2);

    var margins = {top: 5, bottom: 5, left: 5, right: 5},
        histWidth = svgWidth - margins.left - margins.right,
        histHeight = svgHeight - margins.top - margins.bottom;

    // Set scale for width of histogram
    var x = d3.scale.linear()
        .domain([classBreaks[0], classBreaks[c.length - 1]]) //range should be first and last elements in array
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
        .attr("x", function (d, i) {
            return x(extendedClassBreaks[i]);
        })
        .attr("y", function (d, i) {
            return histHeight - y(classCounts[i]);
        }) // y location should be count of entities
        .attr("width", function (d, i) {
            return x(extendedClassBreaks[0] + extendedClassBreaks[i + 1] - extendedClassBreaks[i]);
        }) // scaled range based on class values
        .attr("height", function (d, i) {
            return y(classCounts[i]);
        })
        .attr("class", function (d, i) {
            return "bars " + colorScheme + "q" + parseInt(i / numberClassDivisions) + "-" + (classBreaks.length - 1);
        })
        .on("mouseover", function (d) {
            d3.select(this).transition().duration(50).style("opacity", 0.5);
            console.log(d);
        })
        .on("mouseout", function(d){
            d3.select(this).transition().duration(50).style("opacity", 1);
        });

    barSvg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + histHeight + ")");

    return bar;
}

/////////////////********************//////////////////

// Input: Object containing data key:value pairs
// Output: Print the array of available keys (field names)
function print_attribute_keys(o) {
    var keyList = [];
    for (var k in o[0]) {
        keyList.push(k);
    }
    console.log(keyList);
}

// Input: 
// Output: Pretty print the classes and range of values
function print_class_breaks() {
    for (var i = 0; i < classBreaks.length - 1; i++) {
        console.log("class " + (i + 1) + " : " + classBreaks[i].toFixed(2) + " - " + classBreaks[i + 1].toFixed(2));
    }
}

// Input: 
// Output: None - just sets the style for the counties to designated fill color based on attribute
function classify_map() {
    console.log("Classifying map...");
    counties.style("fill", null)
        .attr("class", function (d) {
            var cl = get_class(dataByID[d.id], classBreaks) - 1;
            return "counties " + colorScheme + "q" + cl + "-" + (classBreaks.length - 1);
        });
}

function classify_dots(){
    console.log("Classifying dots...");
    dots.style("fill", null)
        .attr("class", function (d) {
            var cl = get_class(dataByID[d.id], classBreaks) - 1;
            return "dots " + colorScheme + "q" + cl + "-" + (classBreaks.length - 1);
        });
}

// Input: maximum height (from SVG), data value, and max/min values for the entire dataset to set the range
// Output: scaled height value in pixels
function scale_one_dot(height, value, dataMax, dataMin) {
    return (height * ((value - dataMin) / (dataMax - dataMin)));
}

// Input: Single data value 
// Output: Class number that the value falls into (from 1 to n)
function get_class(value) {
    for (var i = 1; i < classBreaks.length - 1; i++) { // breaks[0] = dataMin
        if (value <= classBreaks[i]) {
            return i;
        }
    }
    return classBreaks.length - 1;
}

// Class counts verified against Tableau viz using same breaks (tested with FIPS and Equal Interval, 5 classes)
function get_class_extended(value, breaks) {
    //console.log(breaks.length);
    for (var i = 1; i < breaks.length - 1; i++) { // breaks[0] = dataMin
        if (value <= breaks[i]) {
            return i;
        }
    }
    return breaks.length - 1;
}

// Input:  
// Output: array listing the number of data values per class
function get_class_counts() {
    var classCounts = [];
    var extendedClasses = [];

    // set up container for counts of each class
    for (var i = 0; i < (classBreaks.length - 1) * numberClassDivisions; i++) {
        classCounts[i] = 0;
    }

    // get breaks for sub-classes (when binsPerClass > 1)
    // create new breaks in-between
    for (var i = 0; i < classBreaks.length - 1; i++) {
        var binSlice = (classBreaks[i + 1] - classBreaks[i]) / numberClassDivisions;
        for (var j = 0; j < numberClassDivisions; j++) {
            extendedClasses.push(classBreaks[i] + j * binSlice)
        }
    }
    extendedClasses.push(classBreaks[classBreaks.length - 1]);

    // classify and count
    for (var i = 0; i < dataDomain.length; i++) {
        var cl = get_class_extended(dataDomain[i], extendedClasses) - 1;
        classCounts[cl] += 1;
    }
    extendedClassBreaks = extendedClasses;
    return classCounts;
}


// Input:
// Output: array listing the area (in square kilometers) for each class
// Note: Currently set to ignore areas for AK and HI since they are a different scale on the map
function get_area_totals() {
    var areaCounts = [];
    // set up empty array to hold area totals for each class
    for (var i = 0; i < (classBreaks.length - 1); i++) {
        areaCounts[i] = 0;
    }
    // tally up the area for each class
    for (var i = 0; i < dataDomain.length; i++) {
        if ((rawData[i]["id"].length == 4 && rawData[i]["id"][0] == "2") || (rawData[i]["id"].length == 5 && rawData[i]["id"].substring(0, 2) == "15")) { // Alaska = 02; Hawaii = 15 FIPS
            continue;
        }else {
            var cl = get_class(dataDomain[i], classBreaks) - 1;
            areaCounts[cl] += parseInt(rawData[i]["area_total_sqkm"]);
        }
    }
    extendedClassBreaks = classBreaks;
    return areaCounts;
}

// Input: 
// Output: array of class breaks (c) - length of number of classes + 1 (min value, class1 high value, class2 high value... classN high value)
function get_class_breaks(s, n, data) {
    console.log("Setting class breaks...");

    if (n <= 2 || n >= 10) {
        alert("You must select between 3 and 9 classes.");
        return;
    }
// setup for using the geostats.js library for classification
    gsData = new geostats(data);

// grab classbreaks using geostats.js library
    switch (s) {
        case "Jenks":
            console.log("jenks");
            c = gsData.getClassJenks(n);
            break;
        case "EqualInterval":
            c = gsData.getClassEqInterval(n);
            break;
        case "Quantile":
            c = gsData.getClassQuantile(n);
            break;
        default:
            alert("Unknown classification scheme selected\n[Jenks, EqualInterval, Quantile]");
            return;
    }
    return c;
}

// Input: 
// Output: None - just triggers the classification of the counties, histogram, and dots
function classify() {

    if (colorScheme == "null" && numberOfClasses == -1 && classScheme == "Single"){
        set_fill_single_color("counties", fillColor);
        set_fill_single_color("dots", fillColor);
        set_fill_single_color("bars", fillColor);
        return;
    }

    classBreaks = get_class_breaks(classScheme, numberOfClasses, dataDomain);
    if (classBreaks) {
        console.log("Classifying data (" + attribute + ") using " + classScheme + " with " + numberOfClasses + " class breaks");
        classify_map();
        classify_dots();

        if(histoType =="area"){
            set_histogram_divisions(1);
            draw_histogram(get_area_totals(), colorScheme);
        } else {
            draw_histogram(get_class_counts(), colorScheme);
        }

        print_class_breaks();
    }
}

function set_value_domain(mapAtts) {
    dataDomain = [];

    mapAtts.forEach(function (d, i) {
        dataByID[d.id] = parseFloat(d[attribute]);
        if (d[attribute]) {
            dataDomain.push(parseFloat(d[attribute]));	//removing the "" null values to make classification work cleanly
        }
    });
}

// Input: String for CSS class that is being re-colored; optional fill color in hex
// Output: None - just sets the style for the class to the designated fill color
function set_fill_single_color(obj, fillColor) {
    console.log("Setting " + obj + " to one color of " + fillColor);
    // can input hex or rgb as "rgb(34,94,168)"
    d3.selectAll("." + obj).style("fill", fillColor);
}

function set_number_breaks(n) {
    // If currently set to one color, change the one class updated in the combo box
    // set the rest to defaults (EqualInterval, 5 class, YlGnBu)
    if (colorScheme == "null" && numberOfClasses == -1 && classScheme == "Single"){
        classScheme = "EqualInterval";
        document.getElementById("classScheme").selectedIndex = 1;
        colorScheme = "YlGnBu";
        document.getElementById("colorScheme").selectedIndex = 1;
    }
    numberOfClasses = n;
    classify();
}

function set_classification_scheme(scheme) {
    // If currently set to one color, change the one class updated in the combo box
    // set the rest to defaults (EqualInterval, 5 class, YlGnBu)
    if (colorScheme == "null" && numberOfClasses == -1 && classScheme == "Single"){
        numberOfClasses = 5;
        document.getElementById("numberClasses").selectedIndex = 3;
        colorScheme = "YlGnBu";
        document.getElementById("colorScheme").selectedIndex = 1;
    }
    classScheme = scheme;
    classify();
}

function set_color_scheme(scheme) {
    // If currently set to one color, change the one class updated in the combo box
    // set the rest to defaults (EqualInterval, 5 class, YlGnBu)
    if (colorScheme == "null" && numberOfClasses == -1 && classScheme == "Single"){
        numberOfClasses = 5;
        document.getElementById("numberClasses").selectedIndex = 3;
        classScheme = "EqualInterval"
        document.getElementById("classScheme").selectedIndex = 1;
    }
    colorScheme = scheme;
    classify();
}

function set_attribute(field) {
    attribute = field;

    set_value_domain(rawData);
    draw_dots(rawMapData);
    classify();
    classify_dots();
    draw_boxplot();
}

function set_histogram_divisions(n) {
    numberClassDivisions = n;
    if (histoType == "count") {
        draw_histogram(get_class_counts(), colorScheme);
    } else {
        numberClassDivisions = 1;
        console.log("Set to 'Count of Polygons' to change number of histogram divisions");
    }
}

function set_histogram_type(type){

    if(type=="byArea"){
        numberClassDivisions = 1;
        histoType = "area";
        draw_histogram(get_area_totals(), colorScheme);
    } else {
        histoType = "count";
        draw_histogram(get_class_counts(), colorScheme);
    }
}

function set_to_single_color(color){
    fillColor = color;
    numberOfClasses = -1;
    document.getElementById("numberClasses").selectedIndex = 0;
    colorScheme = "null";
    document.getElementById("colorScheme").selectedIndex = 0;
    classScheme = "Single";
    document.getElementById("classScheme").selectedIndex = 0;

    classify();
}

function draw_boxplot(){
//if it already exists, remove the svg and re-draw - should only happen when the dataset changes
    d3.select(".boxplot").select("svg").remove();

    var w = d3.select(".boxplot").style("width");
    var h = d3.select(".boxplot").style("height");

    var width = w.substring(0, w.length - 2),
        height = h.substring(0, h.length - 2);

    // 1. Load the data
    //console.log(dataDomain);
    // make the svg to hold the boxplot
    lineSvg = d3.select(".boxplot").append("svg").attr("width", 30).attr("height", 500);

// 2. Find the median, min, max
    var dataMedian = median(dataDomain);
    var dataMin = Math.min.apply(Math, dataDomain);
    var dataMax = Math.max.apply(Math, dataDomain);

    // draw the median line
    lineMedian = lineSvg.append("line")
        .attr("x1", 5)
        .attr("y1", scale_one_dot(height, dataMedian, dataMax, dataMin))
        .attr("x2", width - 5)
        .attr("y2", scale_one_dot(height, dataMedian,dataMax, dataMin))
        .attr("class", "box");

// 3. Find the 25th and 75th percentiles and interquartile range (iqr)
    var dataSort = dataDomain.sort(function(a,b){return a-b});
    var q025 = ss.quantile(dataSort, 0.25);
    var q075 = ss.quantile(dataSort, 0.75);
    var lowBar;
    var highBar;
    var iqr = q075 - q025;
    var q025_iqr = q025 - (1.5 * iqr); // lowest whisker
    var q075_iqr = q075 + (1.5 * iqr); // highest whisker

    //console.log("25th Percentile: " + q025 + "\t-IQR: " + q025_iqr);
    //console.log("75th Percentile: " + q075 + "\t+IQR: " + q075_iqr);

    // draw the box (height goes from q025 - q075)
    rectBox = lineSvg.append("rect")
        .attr("x",5) // upper left corner - 25% line
        .attr("y",scale_one_dot(height, q025, dataMax, dataMin))
        .attr("width", width - 10) // margin of 5 on each side
        .attr("height", function(){
            return scale_one_dot(height, q075, dataMax, dataMin) - scale_one_dot(height,  q025, dataMax, dataMin, dataDomain)
        })
        .attr("class", "box");

    lowerWhisker = lineSvg.append("line")
        .attr("x1", width/2)
        .attr("y1", scale_one_dot(height, q025, dataMax, dataMin))
        .attr("x2", width/2)
        .attr("y2", scale_one_dot(height, q025_iqr,dataMax, dataMin))
        .attr("class", "box");

    upperWhisker = lineSvg.append("line")
        .attr("x1", width/2)
        .attr("y1", scale_one_dot(height, q075, dataMax, dataMin))
        .attr("x2", width/2)
        .attr("y2", scale_one_dot(height, q075_iqr,dataMax, dataMin))
        .attr("class", "box");

// 4. Find any outliers and highest / lowest non-outlier value
    var lowOutliers = [];
    var highOutliers = [];

    if (q025_iqr > Math.min.apply(Math, dataSort)){
        lowBar = q025_iqr;
        for (var i=0; i < dataSort.length; i++){
            if (dataSort[i] >= q025_iqr) {
                break;  // no need to check once we have reached the q025_iqr threshold
            } else {
                if (dataSort[i] < q025_iqr) {
                    lowOutliers.push(dataSort[i]);
                }
            }
        }
    } else {
        lowBar = Math.min.apply(Math, dataSort);
    }

// get high outliers
    if (q075_iqr < Math.max.apply(Math,dataSort)){
        highBar = q075_iqr;
        for (var i=dataSort.length-1; i > 0; i--){
            if (dataSort[i] <= q075_iqr){
                break;  // no need to check further once we have reached the q075_iqr threshold
            } else {
                if (dataSort[i] > q075_iqr) {
                    highOutliers.push(dataSort[i]);
                }
            }
        }
    } else {
        highBar = Math.max.apply(Math, dataSort);
    }
    //console.log("Low whisker: " + lowBar);
    //console.log("High whisker: " + highBar);
    //console.log("Low outliers: " + lowOutliers);
    if (lowOutliers.length > 0){
        lowOutlierThreshold = Math.max.apply(Math, lowOutliers);
        console.log("Highest low outlier: " + lowOutlierThreshold);
    } else lowOutlierThreshold = Math.min.apply(Math, dataSort);
    //console.log("High outliers: " + highOutliers);
    if (highOutliers.length > 0){
        highOutlierThreshold = Math.min.apply(Math, highOutliers);
        console.log("Lowest high outlier: " + highOutlierThreshold);
    } else highOutlierThreshold = Math.max.apply(Math, dataSort);
    function median(values) {
        values.sort( function(a,b) {return a - b;} );

        var half = Math.floor(values.length/2);

        if(values.length % 2)
            return values[half];
        else
            return (values[half-1] + values[half]) / 2.0;
    }
}

function set_outliers(){

    // for key in dataByID - if dataByID[key] < lowOutlierThreshold - outlier... if > highOutlierThreshold - outlier

    for (var key in dataByID){
        var value = dataByID[key]
        if (value >= highOutlierThreshold){
            d3.select(".counties").select("#_" + key).attr("class", "counties highOutlier");
        }
        if (value <= lowOutlierThreshold){
            d3.select(".counties").select("#_" + key).attr("class", "counties lowOutlier")
        }
    }
}

// make a new domain array for just the values that are "not outliers"
// to use in applying classification to the "non outliers" and the "outliers" separately
function create_constrained_domain(){
    constrained_domain = [];
    for(var i in dataDomain){
        if (dataDomain[i] > lowOutlierThreshold && dataDomain[i] < highOutlierThreshold){
            constrained_domain.push(dataDomain[i]);
        }
    }
    return constrained_domain;
}

//function draw_area_histogram(classCounts, colorScheme) {
////if it already exists, remove the svg and re-draw
//    d3.select(".areaHistogram").select("svg").remove();
//
//    var w = d3.select(".areaHistogram").style("width");
//    var h = d3.select(".areaHistogram").style("height");
//
//    var svgWidth = w.substring(0, w.length - 2),
//        svgHeight = h.substring(0, h.length - 2);
//
//    //var svgWidth = 170,
//    //    svgHeight = 100,
//    var margins = {top: 5, bottom: 5, left: 5, right: 5},
//        histWidth = svgWidth - margins.left - margins.right,
//        histHeight = svgHeight - margins.top - margins.bottom;
//
//    // Set scale for width of histogram
//    var x = d3.scale.linear()
//        .domain([classBreaks[0], classBreaks[c.length - 1]]) //range should be first and last elements in array
//        .range([0, histWidth]);
//
//    // Set scale for height of histogram (based on max count)
//    var y = d3.scale.linear()
//        .domain([0, Math.max.apply(Math, classCounts)])
//        .range([0, histHeight]);
//
//    // Generate a histogram using one bin per class.
//    var areabarSvg = d3.select(".areaHistogram").append("svg")
//        .attr("width", svgWidth)
//        .attr("height", svgHeight)
//        .append("g")
//        .attr("transform", "translate(" + margins.left + "," + margins.top + ")");
//
//    var areabar = areabarSvg.selectAll(".bar")
//        .data(classCounts)
//        .enter().append("g")
//        .attr("class", "bar");
//
//    areabar.append("rect")
//        .attr("x", function (d, i) {
//            return x(extendedClassBreaks[i]);
//        })
//        .attr("y", function (d, i) {
//            return histHeight - y(classCounts[i]);
//        }) // y location should be count of entities
//        .attr("width", function (d, i) {
//            return x(extendedClassBreaks[0] + extendedClassBreaks[i + 1] - extendedClassBreaks[i])
//        }) // scaled range based on class values
//        .attr("height", function (d, i) {
//            return y(classCounts[i]);
//        })
//        .attr("class", function (d, i) {
//            return "bars " + colorScheme + "q" + parseInt(i / numberClassDivisions) + "-" + (classBreaks.length - 1);
//        });
//
//    areabarSvg.append("g")
//        .attr("class", "x axis")
//        .attr("transform", "translate(0," + histHeight + ")");
//
//    return areabar;
//}