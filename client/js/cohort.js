// Global settings
const transitionDuration = 800; // time in ms

// Keep the pateints data in memory
let allPatients = [];

const allStagesLabel = "All stages";

// Min and max age across all the patients
let minAge;
let maxAge;

// encounterDateStr is a string, not Date object
function getPatientEncounterAgeByDateString(encounterDateStr, birthday) {
    // birthday is a string
    let ageDiffMs =  new Date(encounterDateStr).getTime() - new Date(birthday).getTime();
    let ageDate = new Date(ageDiffMs); // miliseconds from epoch
    return Math.abs(ageDate.getUTCFullYear() - 1970);
}

// Entry point
function showCohort() {
    $.ajax({
	    url: baseUri + '/cohortData',
	    method: 'GET', 
	    async : true,
	    dataType : 'json'
	})
	.done(function(response) {
        // Draw the stages chart
        // We can click the stage bar to show charts of this stage 
        // and unclick to show all again
        showStagesChart("stages", response.stagesInfo);

        // Keep the data in memory for later use
        allPatients = response.patientsInfo.patients;

        // By default show charts of all pateints and all stages
        showDerivedCharts(allPatients, allStagesLabel);
	})
	.fail(function () { 
	    console.log("Ajax error - can't get cancer stages");
	});
}

function showStagesChart(svgContainerId, data) {
	let patientsCounts = {};

	// In order to get the minAge and maxAge
	let minAges = [];
	let maxAges = [];

	// Calculate and add the box plot data to each stageInfo object
	data.forEach(function(stageInfo) {
		// Initialise stats object
	    let ageStats = {
	        minVal: Infinity,
	        lowerWhisker: Infinity,
	        q1Val: Infinity,
	        medianVal: 0,
	        q3Val: -Infinity,
	        iqr: 0, // Interquartile range or IQR
	        upperWhisker: -Infinity,
	        maxVal: -Infinity
	    };

	    // calculate statistics
	    // stageInfo.ages is already sorted array
	    ageStats.minVal = stageInfo.ages[0];
	    ageStats.q1Val = Math.round(d3.quantile(stageInfo.ages, .25));
	    ageStats.medianVal = Math.round(d3.quantile(stageInfo.ages, .5));
	    ageStats.q3Val = Math.round(d3.quantile(stageInfo.ages, .75));
	    ageStats.iqr = ageStats.q3Val - ageStats.q1Val;
	    ageStats.maxVal = stageInfo.ages[stageInfo.ages.length - 1];
        
        // Add new property
	    stageInfo.ageStats = ageStats;

	    // Add to patientsCounts object for later use (modify the Y label)
	    if (typeof patientsCounts[stageInfo.stage] === "undefined") {
            patientsCounts[stageInfo.stage] = stageInfo.patientsCount;
	    }

	    // Also kepp record of the min age and max age for rendering the x axis as well as 
	    // age range in the patients table
	    minAges.push(ageStats.minVal);
	    maxAges.push(ageStats.maxVal);
	});

    // Make the min and max age range global
    minAge = Math.min.apply(null, minAges);
    maxAge = Math.max.apply(null, maxAges);

	// set the dimensions and margins of the graph
	const svgWidth = 420;
	const svgHeight = 280;
	// svgPadding.top is used to position the chart title
	// svgPadding.left is the space for Y axis labels
	const svgPadding = {top: 10, right: 15, bottom: 15, left: 75};
	const chartWidth = svgWidth - svgPadding.left - svgPadding.right;
	const chartHeight = svgHeight - svgPadding.top - svgPadding.bottom;
	// Gap between svg top and chart top, nothing to do with svgPadding.top
	const chartTopMargin = 48;

    // Box plot
    const boxHeight = 4;
    const textBottomPadding = 1;

    // Sort this uniqueStages array in a specific order
    const orderedCancerStages = [
        'Stage 0', 
        // Stage I
        'Stage I',
        'Stage IA',
        'Stage IB',
        'Stage IC',
        // Stage II
        'Stage II',
        'Stage IIA',
        'Stage IIB',
        'Stage IIC',
        // Stage III
        'Stage III',
        'Stage IIIA',
        'Stage IIIB',
        'Stage IIIC',
        // Stage IV
        'Stage IV',
        'Stage IVA',
        'Stage IVB',
        'Stage IVC'
    ];

    // All top-level stages
    const topLevelStages = [
        'Stage 0', 
        'Stage I', 
        'Stage II', 
        'Stage III', 
        'Stage IV'
    ];

    // All stages found in data
    let allStages = data.map(function(d) { 
		return d.stage; 
	});

	// By default only show the top level stages
	let topStagesData = data.filter(function(d) { 
		if (topLevelStages.indexOf(d.stage) !== -1) {
            return d.stage;
		}
	});

	// set the ranges
	let x = d3.scaleLinear()
	    .range([0, chartWidth])
	    // Integer age range based on rounding the minAge and maxAge
	    .domain([Math.floor(minAge/10) * 10, Math.ceil(maxAge/10) * 10]);
	    
    let xCount = d3.scaleLinear()
	    .range([0, chartWidth])
	    .domain([0, d3.max(data, function(d) { 
			return d.patientsCount; 
		})]);

	let y = d3.scaleBand()
		.range([0, chartHeight - chartTopMargin]) // top to bottom: stages by patients count in ascending order 
		// Set the y domain based on the filteredData
		.domain(topStagesData.map(function(d) { 
			return d.stage; 
		}))
		.padding(0.1); // blank space between bands

	let svg = d3.select("#" + svgContainerId).append("svg")
		.attr("width", svgWidth)
		.attr("height", svgHeight);

	let stagesChartGrp = svg.append("g")
		.attr("transform", "translate(" + svgPadding.left + "," + chartTopMargin + ")");

    // Chart title
    svg.append("text")
        .attr("class", "stages_chart_title")
        .attr("transform", function(d) { 
        	// Works together with "dominant-baseline:text-before-edge;"" in CSS
        	// to position the text based on upper left corner
			return "translate(" + svgWidth/2 + ", " + svgPadding.top + ")"; 
		})
        .text("Cancer Stages");

    // Render the bars and boxplots with the filteredData before rendering the Y axis
    // so the Y axis vertical line covers the bar border
    renderBarsAndBoxplots(topStagesData);
    // renderYAxis() is based ont the y.domain(), so no argument
    renderYAxis();

    // Add patients count top X axis
	stagesChartGrp.append("g")
		//.attr("transform", "translate(0, 0)")
		.attr("class", "count_axis")
		.call(d3.axisTop(xCount))
		// Append axis label
		.append("text")
		.attr("class", "count_axis_label")
		.attr("x", chartWidth)
		.attr("y", 12)
		.text("Number of patients");
   
    // Add the ages bottom X Axis
	stagesChartGrp.append("g")
		.attr("transform", "translate(0, " + (chartHeight - chartTopMargin) + ")")
		.attr("class", "age_axis")
		.call(d3.axisBottom(x))
		// Append axis label
		.append("text")
		.attr("class", "age_axis_label")
		.attr("x", chartWidth)
		.attr("y", -6)
		.text("Age of first encounter");


    // Render all stage bars and boxplots
	function renderBarsAndBoxplots(data) {
	    // Bar chart of patients counts
		stagesChartGrp.append("g").selectAll(".stage_bar")
			.data(data)
			.enter().append("rect")
			.attr("class", function(d) {
				// Distiguish the top stages and sub stages using different bg and border colors
				return "stage_bar " + ((topLevelStages.indexOf(d.stage) !== -1) ? "top_stage_bar " : "sub_stage_bar ") + d.stage.replace(" ", "_") ;
			})
			.attr("transform", function(d) { 
				return "translate(0, " + y(d.stage) + ")"; 
			})
			.attr("height", y.bandwidth())
			.on("click", function(d) {
	            let clickedBar = d3.select(this);
	            let css = "clicked_bar";

	            // Toggle
	            if (!clickedBar.classed(css)) {
	            	// Remove previouly added css class
		            d3.selectAll(".stage_bar").classed(css, false);
	                // Highlight the clicked box and show corresponding patients
	            	clickedBar.classed(css, true);
	            	showDerivedCharts(d.patients, d.stage);
	            } else {
	            	// When clicked again, remove highlight and show all patients
	            	clickedBar.classed(css, false);
	            	// allPatients is the patient data saved in memory
	            	showDerivedCharts(allPatients, allStagesLabel);
	            }
			})
			.transition()
	        .duration(transitionDuration)
			.attr("width", function(d) { 
				return xCount(d.patientsCount);
			});


	    // Only show the patient age when the stage has only one patient
	    let singlePatientGrp = stagesChartGrp.append("g").selectAll(".single_patient_group")
			.data(data.filter(function(d) {
				return d.patientsCount === 1;
			}))
			.enter().append("g")
			.attr("class", function(d) {
				return "single_patient_group " + d.stage.replace(" ", "_");
			})
			.attr("transform", function(d) {
				return "translate(0, " + (y(d.stage) + y.bandwidth()/2) + ")";
			});

		// Verical line of single age
		singlePatientGrp.append("line")
			.attr("class", "single_patient_age_line")
			.attr("x1", function(d) {
	            return x(d.ageStats.minVal);
			})
			.attr("y1", 0)
			.attr("x2", function(d) {
	            return x(d.ageStats.minVal);
			})
			.attr("y2", boxHeight);

		// Text of single age
		singlePatientGrp.append("text")
			.attr("class", "single_patient_text")
			.attr("x", function(d) {
	            return x(d.ageStats.minVal);
			})
			.attr("y", -textBottomPadding)
			.text(function(d) {
	            return d.ageStats.minVal;
			});

		// Show the box plot for stage that has more than one patient
		let boxplotGrp = stagesChartGrp.append("g").selectAll(".boxplot")
			.data(data.filter(function(d) {
				return d.patientsCount > 1;
			}))
			.enter().append("g")
			.attr("class", function(d) {
				return "boxplot " + d.stage.replace(" ", "_");
			})
			.attr("transform", function(d) {
				return "translate(0, " + (y(d.stage) + y.bandwidth()/2) + ")";
			});
			
	    // Verical line of min age
		boxplotGrp.append("line")
			.attr("class", "boxplot_min")
			.attr("x1", function(d) {
	            return x(d.ageStats.minVal);
			})
			.attr("y1", 0)
			.attr("x2", function(d) {
	            return x(d.ageStats.minVal);
			})
			.attr("y2", function(d) {
				return boxHeight;
			});

		// Text of min age
		boxplotGrp.append("text")
			.attr("class", "boxplot_text")
			.attr("x", function(d) {
	            return x(d.ageStats.minVal);
			})
			.attr("y", function(d) {
				return -textBottomPadding;
			})
			.text(function(d) {
	            return d.ageStats.minVal;
			});

		// Vertical line of max age
		boxplotGrp.append("line")  
			.attr("class", "boxplot_max")
			.attr("x1", function(d) {
	            return x(d.ageStats.maxVal);
			})
			.attr("y1", 0)
			.attr("x2", function(d) {
	            return x(d.ageStats.maxVal);
			})
			.attr("y2", boxHeight);

	    // Text of max age
		boxplotGrp.append("text")
			.attr("class", "boxplot_text")
			.attr("x", function(d) {
	            return x(d.ageStats.maxVal);
			})
			.attr("y", -textBottomPadding)
			.text(function(d) {
	            return d.ageStats.maxVal;
			});

		// Horizontal whisker lines
		boxplotGrp.append("line")
			.attr("class", "boxplot_whisker")
			.attr("x1",  function(d) {
	            return x(d.ageStats.minVal);
			})
			.attr("y1", boxHeight/2)
			.attr("x2",  function(d) {
	            return x(d.ageStats.maxVal);
			})
			.attr("y2", boxHeight/2);

		// Rect for iqr
		boxplotGrp.append("rect")    
			.attr("class", "boxplot_box")
			.attr("x", function(d) {
	            return x(d.ageStats.q1Val);
			})
			.attr("y", 0)
			.attr("height", boxHeight)
			// Add transition on box rect rendering
			.transition()
	        .duration(transitionDuration)
	        .attr("width", function(d) {
	            return x(d.ageStats.q3Val) - x(d.ageStats.q1Val);
			});
	    
	    // Text of q1 age
		boxplotGrp.append("text")
			.attr("class", "boxplot_text")
			.attr("x", function(d) {
	            return x(d.ageStats.q1Val);
			})
			.attr("y", -textBottomPadding)
			.text(function(d) {
	            return d.ageStats.q1Val;
			});

		// Text of q3 age
		boxplotGrp.append("text")
			.attr("class", "boxplot_text")
			.attr("x", function(d) {
	            return x(d.ageStats.q3Val);
			})
			.attr("y", -textBottomPadding)
			.text(function(d) {
	            return d.ageStats.q3Val;
			});

	    // Must after the box so the bar doesn't gets covered by the box
		// Vertical line of median age
		boxplotGrp.append("line")
			.attr("class", "boxplot_median")
			.attr("x1", function(d) {
	            return x(d.ageStats.medianVal);
			})
			.attr("y1", 0)
			.attr("x2", function(d) {
	            return x(d.ageStats.medianVal);
			})
			.attr("y2", boxHeight);

		// Text of median age
		boxplotGrp.append("text")
			.attr("class", "boxplot_text")
			.attr("x", function(d) {
	            return x(d.ageStats.medianVal);
			})
			.attr("y", -textBottomPadding)
			.attr("text-anchor", "middle")
			.text(function(d) {
				return d.ageStats.medianVal;
			});
	}

    // Render Y axis
	function renderYAxis() {
		stagesChartGrp.append("g")
		    .attr("transform", "translate(0, 0)")
		    .attr("id", "y_axis")
			.call(d3.axisLeft(y))
			// Add custom id to each tick group
			.selectAll(".tick")
			.attr("class", function(d) {
				// Distiguish the top stage and sub stage labels using different colors
				return "tick " + ((topLevelStages.indexOf(d) !== -1) ? "top_stage" : "sub_stage");
			})
			// Now modify the label text to add patients count
			.selectAll("text")
			.text(function(d) {
				return d + " (" + patientsCounts[d] + ")";
			});

        // Only add click event to top level stages
		d3.selectAll(".top_stage").on("click", function(d) {
            let displayStages = y.domain();

            // Click top-level stage label to show sub level stages
            let subLevels = [d + "A",  d + "B", d  + "C"];
            let addedSubStages = [];
            let removedSubStages = [];

			subLevels.forEach(function(stage) {
			    // sub stage must belong to the allStages
			    if (allStages.indexOf(stage) !== -1) {
                    // Add this sub stage to the stages to display when expanding the top stage
                    // Remove the sub stage from the display stages when collapsing the top stage
                    if (displayStages.indexOf(stage) === -1) {
	                    displayStages.push(stage);

	                    // Also add to updatedSubStages so we know the changes
	                    // No need to sort this array since it's based on the A, B, C
	                    addedSubStages.push(stage);
				    } else {
	                    let index = displayStages.indexOf(stage);
	                    displayStages.splice(index, 1);

                        // Also add to removedSubStages
	                    removedSubStages.push(stage);
				    }
                }
			});

            // Same as the one in dataProcessor
            function sortByProvidedOrder(array, orderArr) {
		        let orderMap = new Map();

		        orderArr.forEach(function(item) { 
		            // Remember the index of each item in order array
		            orderMap.set(item, orderArr.indexOf(item));
		        });

		        // Sort the original array by the item's index in the orderArr
		        // It's very possible that items are in array may not be in orderArr
		        // so we assign index starting from orderArr.length for those items
		        let i = orderArr.length;
		        let sortedArray = array.sort(function(a, b){ 
		            if (!orderMap.has(a)) {
		                orderMap.set(a, i++);
		            }
		 
		            if (!orderMap.has(b)) {
		                orderMap.set(b, i++);
		            }

		            return (orderMap.get(a) - orderMap.get(b));
		        });

		        return sortedArray;
		    }

            // Need to sort the displayStages so the sub-stages appear under each top-stage
            let sortedDisplayStages = sortByProvidedOrder(displayStages, orderedCancerStages);

            // Also update the y.domain()
		    y.domain(sortedDisplayStages);

            // Now for UI updates
            d3.selectAll("#y_axis").remove();

            function reposition() {
	            // Repoition the existing stage bars and resize height
	            d3.selectAll(".stage_bar")
	                .transition()
					.duration(transitionDuration)
	                .attr("transform", function(d) {
	                	return "translate(0, " + y(d.stage) + ")";
	                })
					.attr("height", y.bandwidth());

	            // Reposition the single pateint groups
	            d3.selectAll(".single_patient_group")
	                .transition()
					.duration(transitionDuration)
	                .attr("transform", function(d) {
	                	return "translate(0, " + (y(d.stage) + y.bandwidth()/2) + ")";
	                });

	            // Reposition the boxplots
	            d3.selectAll(".boxplot")
	                .transition()
					.duration(transitionDuration)
	                .attr("transform", function(d) {
	                	return "translate(0, " + (y(d.stage) + y.bandwidth()/2) + ")";
	                });
            }

            // Add sub stage bars and boxplots
            if (addedSubStages.length > 0) {
                let updatedData = data.filter(function(d) { 
					if (addedSubStages.indexOf(d.stage) !== -1) {
			            return d.stage;
					}
				});

                // Reposition the exisiting stages BEFORE adding new sub stages
	            reposition();

                // The last thing is to add new sub stages
				renderBarsAndBoxplots(updatedData);
            }

            // Or remove sub stage bars and boxplots
			if (removedSubStages.length > 0) {
				removedSubStages.forEach(function(stage) {
                    // Can't get the transition work here with reposition
                    d3.selectAll("." + stage.replace(" ", "_"))
						.remove();
						
				});

				// Reposition the rest of stages AFTER removing target sub stages
				reposition();
			}	

            // Re-render Y axis after the bars/boxplots so the vertical line covers the bar border
		    renderYAxis();
		});
    }
}

// No rest call since each stage data contains the patients list info
function showDerivedCharts(patientsArr, stage) {
	// Create an array of patient names
    let patientNames = [];
    patientsArr.forEach(function(patient) {
    	patientNames.push(patient.name);
    });

    // Patients table
    showPatientsTable("patients", patientsArr, stage);

    // Show patients bubble chart
    showPatientsChart("patients2", patientsArr, stage);

    // Make another ajax call to get all tumor info for the list of patients
    getPatientsTumorInfo(patientNames, stage);

    // Make another ajax call to get diagnosis for the list of patients
    getDiagnosis(patientNames, stage);
}

// All patients is a separate call
// patients of each stage is alrady loaded data
function showPatientsTable(containerId, data, stage) {
    // Group patients by age of first encounter
    let rangeStartAge = Math.floor(minAge/10) * 10;
    let rangeEndAge = Math.ceil(maxAge/10) * 10;

    // Calculate the age range
    let range = [];
    let ageRange = [];
    for (let i = 0; i < (rangeEndAge - rangeStartAge)/10; i++) {
        if (i === 0) {
            ageRange = [rangeStartAge + i * 10, rangeStartAge + i * 10 + 10];
        } else {
        	ageRange = [rangeStartAge + i * 10 + 1, rangeStartAge + i * 10 + 10];
        }

        range.push(ageRange);
    }

    let rangePatients = [];
    range.forEach(function(range) {
    	let patients = [];
    	// The data is already sorted by patient age of first encounter
        data.forEach(function(patient) {
            let firstEncounterAge = getPatientEncounterAgeByDateString(patient.firstEncounterDate, patient.birthday);

            if (firstEncounterAge >= range[0] && firstEncounterAge <= range[1]) {
                patients.push(patient);
            }
        });
        rangePatients.push(patients);
    });

    let html =  '<table class="patients_table">'
        + '<caption class="patients_table_title">Patients Table (' + data.length + ' patients from ' + stage + ')</caption>'
        + '<tr><th>First Encounter Age Range</th><th>Patient List Ordered By First Encounter Age</th><th>Count</th></tr>';

    for (let i = 0; i < rangePatients.length; i++) {
        html += '<tr><th>' + range[i][0] + ' - ' + range[i][1] + '</th>';
        html += '<td><ul class="patient_age_range_list">';
        rangePatients[i].forEach(function(patient) {
	    	html += '<li><a href="' + baseUri + '/patient/' + patient.name + '">' + getPatientShortName(patient.name) + '</a> (' + getPatientEncounterAgeByDateString(patient.firstEncounterDate, patient.birthday) + ')</li>';
	    });
	    html += '</ul></td><td>' + rangePatients[i].length + '</td></tr>';
    }
    
    html += '</table>';

    $("#" + containerId).html(html);
}

function showPatientsChart(svgContainerId, data, stage) {
    d3.select("#" + svgContainerId).selectAll("*").remove();

    let patients = {
    	"children": data
    };

    const svgWidth = 420;
    const svgHeight = 280;
    const svgPadding = {top: 10, right: 10, bottom: 10, left: 10};
	const chartWidth = svgWidth - svgPadding.left - svgPadding.right;
	const chartHeight = svgHeight - svgPadding.top - svgPadding.bottom;
	const chartTopMargin = 30;

	let svg = d3.select("#" + svgContainerId).append("svg")
		    .attr("class", "patients_chart") // Used for CSS styling
			.attr("width", svgWidth)
			.attr("height", svgHeight);

	let patientsChartGrp = svg.append("g")
			    .attr("class", "patients_chart_group")
			    .attr("transform", "translate(" + svgPadding.left + "," + chartTopMargin + ")");
    
    // Chart title
    svg.append("text")
        .attr("class", "patients_chart_title")
        .attr("transform", function(d) { 
			return "translate(" + svgWidth/2 + ", " + svgPadding.top + ")"; 
		})
        .text("Patients (" + data.length + " patients from " + stage + ")");

    // Creates a new pack layout with the default settings
	let pack = d3.pack()
		.size([chartWidth, chartHeight - chartTopMargin])
		.padding(3);


	let root = d3.hierarchy(patients)
	    .sum(function(d) { 
	    	return getPatientEncounterAgeByDateString(d.firstEncounterDate, d.birthday); 
	    });

	let node = patientsChartGrp.selectAll(".node")
		.data(pack(root).leaves())
		.enter().append("g")
		.attr("class", "node")
		.attr("transform", function(d) { 
			return "translate(" + d.x + "," + d.y + ")"; 
		});

	node.append("circle")
		.attr("id", function(d) { 
			return d.id; 
		})
		.attr("class", "patient_circle")
		.attr("r", function(d) { 
			return d.r; 
		})
		.on("click", function(d) {
			let patientName = d.data.name;
			window.location = baseUri + "/patient/" + patientName;
		});

	node.append("text")
	    .attr("class", "patient_name")
		.text(function(d) { 
			return getPatientShortName(d.data.name);
		});
}

function getPatientShortName(longName) {
    return "P" + longName.slice(7); 
}

function getPatientLongName(shortName) {
    return "Patient" + shortName.slice(1); 
}

function showDiagnosisChart(svgContainerId, data, stage) {
    d3.select("#" + svgContainerId).selectAll("*").remove();

    const svgWidth = 620;
    const svgHeight = 280;
	const svgPadding = {top: 10, right: 15, bottom: 12, left: 248};
	const chartWidth = svgWidth - svgPadding.left - svgPadding.right;
	const chartHeight = svgHeight - svgPadding.top - svgPadding.bottom;
	const chartTopMargin = 40;

	let svg = d3.select("#" + svgContainerId).append("svg")
		    .attr("class", "diagnosis_chart") // Used for CSS styling
			.attr("width", svgWidth)
			.attr("height", svgHeight);

	let diagnosisChartGrp = svg.append("g")
			    .attr("class", "diagnosis_chart_group")
			    .attr("transform", "translate(" + svgPadding.left + "," + chartTopMargin + ")");
    
    const dotColor = "rgb(107, 174, 214)";
    const highlightedDotColor = "rgb(230, 85, 13)";

    let xDomain = [];
    
    let diagnosisDots = [];

    data.data.forEach(function(d) {
    	let patientShortName = getPatientShortName(d.patient);

    	xDomain.push(patientShortName);

    	d.diagnosis.forEach(function(diagnosis) {
    		let dot = {};
    		dot.patientShortName = patientShortName;
    		dot.diagnosis = diagnosis;

    		diagnosisDots.push(dot);
    	});
    });

	// set the ranges
	let x = d3.scalePoint()
	    .range([10, chartWidth])
	    .domain(xDomain);
	    
	let y = d3.scalePoint()
		.range([0, chartHeight - chartTopMargin - svgPadding.bottom - 10]) // extra 10 gap
		.domain(data.diagnosis);
	
	// Replace all spaces and () with underscores
    let diagnosis2Class = function(diagnosis) {
        return diagnosis.replace(/ |\(|\)/g, "_");
    };

	// Chart title
    svg.append("text")
        .attr("class", "diagnosis_chart_title")
        .attr("transform", function(d) { 
			return "translate(" + svgWidth/2 + ", " + svgPadding.top + ")"; 
		})
        .text("Diagnosis (" + xDomain.length + " patients from " + stage + ")");

	// Patient diagnosis dots
	diagnosisChartGrp.selectAll(".diagnosis_dot")
		.data(diagnosisDots)
		.enter().append("circle")
		.attr("class", function(d) {
			return "diagnosis_dot " + d.patientShortName;
		})
		.attr("cx", function(d, i) {
            return x(d.patientShortName);
		})
		.attr("cy", function(d) { 
            return y(d.diagnosis);
		})
		.attr("r", 4)
		.attr("fill", dotColor);
		
		
	// add the x Axis
	diagnosisChartGrp.append("g")
		.attr("transform", "translate(0," + (chartHeight - chartTopMargin - svgPadding.bottom) + ")")
		.call(d3.axisBottom(x))
		.selectAll("text")	
		.attr("class", "diagnosis_x_label")
        .attr("dx", "-.8em")
        .attr("dy", ".15em")
        .attr("transform", "rotate(-65)")
        .on("mouseover", function(d) {
            // Highlight all dots of this patient
            d3.selectAll("." + d)
                .attr("r", 7)
                .attr("fill", highlightedDotColor);

            // Insert instead of append() guideline so it gets covered by dots
            d3.select(".diagnosis_chart_group").insert("line", ":first-child")
				.attr("class", "diagnosis_guideline")
				.attr("x1", x(d))
				.attr("y1", 0)
				.attr("x2", x(d))
				.attr("y2", chartHeight - chartTopMargin);

			// Also highlight the corresponding Y labels
			data.patients[getPatientLongName(d)].forEach(function(diagnosis) {
				$("." + diagnosis2Class(diagnosis)).addClass("highlighted_diagnosis_label");
			});
        })
        .on("mouseout", function(d) {
            // Reset dot size and color
            d3.selectAll("." + d)
                .attr("r", 4)
                .attr("fill", dotColor);

            // Remove added guideline
            d3.selectAll(".diagnosis_guideline").remove();

            // Also dehighlight the corresponding Y labels
			data.patients[getPatientLongName(d)].forEach(function(diagnosis) {
				$("." + diagnosis2Class(diagnosis)).removeClass("highlighted_diagnosis_label");
			});
        });

	// add the y Axis
	diagnosisChartGrp.append("g")
		.call(d3.axisLeft(y))
		// Now add class to the label text
		.selectAll("text")
		.attr("class", function(d) {
			return diagnosis2Class(d);
		})
		// Replace underscore with white space
		.text(function(d) {
			return d;
		});
}


function showBiomarkersChart(svgContainerId, data, stage) {
    const biomarkerStatus = ['positive', 'negative', 'unknown'];

    const svgWidth = 420;
    const svgHeight = 280;
	const svgPadding = {top: 10, right: 10, bottom: 15, left: 45};
	const chartWidth = svgWidth - svgPadding.left - svgPadding.right;
	const chartHeight = svgHeight - svgPadding.top - svgPadding.bottom;
	const chartTopMargin = 35;

    const legendGroupWidth = 60;
    const legendRectSize = 10;
    const legnedTextRectPad = 3;

    // Band scale of biomarkers
	let biomarkerScale = d3.scaleBand()
	    .domain(data.biomarkersPool)
	    .rangeRound([0, chartHeight - chartTopMargin])
	    .padding(0.15);

    // Band scale of status
	let statusScale = d3.scaleBand()
	    .domain(biomarkerStatus)
	    .rangeRound([0, biomarkerScale.bandwidth()])
	    .padding(0.15);

    // Percentage
	let x = d3.scaleLinear()
	    .rangeRound([0, chartWidth - legendGroupWidth])
	    .domain([0, 1]);

    // Colors of status: positive, negative, unknown
    let color = d3.scaleOrdinal()
        .range(["rgb(214, 39, 40)", "rgb(44, 160, 44)", "rgb(150, 150, 150)"]);

    // https://github.com/d3/d3-format
    let formatPercent = d3.format(".0%");

    // Only draw everything for the first time
    if (d3.select(".biomarkers_chart_group").empty()) {
	    let svg = d3.select("#" + svgContainerId).append("svg")
		    .attr("class", "biomarkers_chart") // Used for CSS styling
			.attr("width", svgWidth)
			.attr("height", svgHeight);
		
		let biomarkersChartGrp = svg.append("g")
			    .attr("class", "biomarkers_chart_group")
			    .attr("transform", "translate(" + svgPadding.left + "," + chartTopMargin + ")");

	    // Chart title
	    svg.append("text")
	        .attr("class", "biomarkers_chart_title")
	        .attr("transform", function(d) { 
				return "translate(" + svgWidth/2 + ", " + svgPadding.top + ")"; 
			})
	        .text("Biomarkers (" + data.patients.length + " patients from " + stage + ")");


	    let biomarkerGrp = biomarkersChartGrp.selectAll(".biomarker_group")
			.data(data.data)
			.enter().append("g")
			.attr("class", "biomarker_group")
			.attr("transform", function(d) { 
				return "translate(0, " + biomarkerScale(d.biomarker) + ")"; 
			});

	    // Status bars inside each biomarker group
		biomarkerGrp.selectAll(".biomarker_status_bar")
		    // here d is each object in the data.data array
			.data(function(d) { 
				// Creates a new data array of objects
				// each object is like {status: "positive", percentage: 0.73}
				let statusPercentageArr = biomarkerStatus.map(function(status) { 
				    return {status: status, percentage: d[status]}; 
				}); 

				return statusPercentageArr;
			})
			.enter().append("rect")
			.attr("class", function(d) {
				return "biomarker_status_bar " + d.status;
			})
			.attr("x", 0)
			.attr("y", function(d) { 
				return statusScale(d.status); 
			})
			.attr("height", statusScale.bandwidth())
			// fill-opacity is specified in CSS
			.attr("fill", function(d) { 
				return color(d.status); 
			})
			.attr("stroke", function(d) { 
				return color(d.status); 
			})
			.transition()
	        .duration(transitionDuration)
			.attr("width", function(d) { 
				return x(d.percentage);
			});

	    // Show percentage text by the each status bar
	    biomarkerGrp.selectAll(".biomarker_status_percentage")
			.data(function(d) { 
				// Creates a new data array of objects
				// each object is like {biomarker: "ER", status: "positive", percentage: 0.73}
				let statusPercentageArr = biomarkerStatus.map(function(status) { 
				    return {biomarker: d.biomarker, status: status, percentage: d[status]}; 
				}); 

				return statusPercentageArr;
			})
			.enter().append("text")
			.attr("class", "biomarker_status_percentage")
			.attr("id", function(d) {
				return d.biomarker + "_" + d.status;
			})
			.attr("y", function(d) { 
				return statusScale(d.status) + statusScale.bandwidth()/2; 
			})
			.text(function(d) {
				return formatPercent(d.percentage);
			})
			// text x position transition
			.transition()
	        .duration(transitionDuration) // time in ms
			.attr("x", function(d) { 
				return x(d.percentage) + 2;
			})
			// percentage text tween transition
	        .tween("text", function(d) {
				let i = d3.interpolate(0, d.percentage);
				return function(t) {
	                // Don't use d3.select(this) here
	                // must explicitly use d3.select("#" + d.biomarker + "_" + d.status)
					d3.select("#" + d.biomarker + "_" + d.status).text(formatPercent(i(t)));
				};
			});

	    // Y axis
		biomarkersChartGrp.append("g")
			.attr("class", "biomarkers_chart_y_axis")
			.call(d3.axisLeft(biomarkerScale));

	    // X axis
		biomarkersChartGrp.append("g")
			.attr("class", "biomarkers_chart_x_axis")
			.attr("transform", "translate(0," + (chartHeight - chartTopMargin) + ")")
			.call(d3.axisBottom(x).tickFormat(formatPercent))
			.append("text")
			    .attr("class", "biomarkers_chart_x_axis_label")
				.attr("y", -6)
				.attr("x", x(x.ticks().pop()) + 0.5)
				.text("Percentage of biomarker status");

	    // Status legend
		let legend = biomarkersChartGrp.append("g")
			.attr("class", "biomarkers_chart_legend")
			.selectAll("g")
			.data(biomarkerStatus)
			.enter().append("g")
			.attr("transform", function(d, i) { 
				return "translate(0," + i * (legendRectSize + legnedTextRectPad) + ")"; 
			});

		legend.append("rect")
		    .attr("class", "biomarker_status_legend")
			.attr("x", chartWidth - legendRectSize)
			.attr("width", legendRectSize)
			.attr("height", legendRectSize)
			.attr("fill", function(d) { 
				return color(d); 
			})
			.attr("stroke", function(d) { 
				return color(d); 
			});

		legend.append("text")
		    .attr("class", "biomarker_status_legend_text")
			.attr("x", chartWidth - legendRectSize - legnedTextRectPad)
			.attr("y", 9)
			.text(function(d) { 
				return d; 
			});
    } else {
    	// No worries about ordering
    	let percents = [];
    	data.data.forEach(function(obj) {
            percents.push(obj.positive);
            percents.push(obj.negative);
            percents.push(obj.unknown);
    	});

        // Update the width of each status bar with new data
        d3.selectAll(".biomarker_status_bar")
            .transition()
            .duration(transitionDuration)
    	    .attr("width", function(d, i) {
    	    	// Here d still maintains the old data from the first load
    	    	// E.g., {status: "positive", percentage: "0.73"}
    	    	return x(percents[i]);
    	    });

        // Update percentage texts and x position with new data
        d3.selectAll(".biomarker_status_percentage")
            .transition()
            .duration(transitionDuration)
    	    .attr("x", function(d, i) {
    	    	// Here d still maintains the old data from the first load before any partial update
	        	// But we need to use the new percentage data
    	    	// E.g., {biomarker: "ER", status: "positive", percentage: "0.73"}
    	    	return x(percents[i]) + 2;
    	    })
    	    .text(function(d, i) {
    	    	return formatPercent(percents[i]);
    	    })
	        .tween("text", function(d, i) {
    	    	// The d3.interpolate method receives the beginning and end values of the transition, 
    	    	// and returns an interpolator function. An interpolator function receives a value between 0 and 1, 
    	    	// and returns the interpolated value.
    	    	let previousPercent = (parseFloat(d3.select("#" + d.biomarker + "_" + d.status).text()) / 100).toFixed(2);
				let interpolate = d3.interpolate(previousPercent, percents[i]);
				return function(t) {
	                // Don't use d3.select(this) here
	                // must explicitly use d3.select("#" + d.biomarker + "_" + d.status)
					d3.select("#" + d.biomarker + "_" + d.status).text(formatPercent(interpolate(t)));
				};
			});

        // Also update the chart title with patients count
        d3.select(".biomarkers_chart_title")
	        .text("Biomarkers (" + data.patients.length + " patients from " + stage + ")");
    }
}

function getPatientsTumorInfo(patientNames, stage) {
    $.ajax({
	    url: baseUri + '/tumorinfo/' + patientNames.join('+'),
	    method: 'GET', 
	    async : true,
	    dataType : 'json' 
	})
	.done(function(response) {
	    //console.log(response);
        
	    showBiomarkersChart("biomarkers", response.biomarkersInfo, stage);
	})
	.fail(function () { 
	    console.log("Ajax error - can't get patients tumor info");
	});
}

function getDiagnosis(patientNames, stage) {
    $.ajax({
	    url: baseUri + '/diagnosis/' + patientNames.join('+'),
	    method: 'GET', 
	    async : true,
	    dataType : 'json' 
	})
	.done(function(response) {
	    showDiagnosisChart("diagnosis", response, stage);
	})
	.fail(function () { 
	    console.log("Ajax error - can't get patients diagnosis info");
	});
}