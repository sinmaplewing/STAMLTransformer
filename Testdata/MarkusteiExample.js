var funcs = (function(){
	String.prototype.escape = function() {
	    var tagsToReplace = {
	        '&': '&amp;',
	        '<': '&lt;',
	        '>': '&gt;'
	    };
	    return this.replace(/[&<>]/g, function(tag) {
	        return tagsToReplace[tag] || tag;
	    });
	};

	var metadataTable = [
		{ from: "/TEI/teiHeader/fileDesc/titleStmt/title", to: "filename"}
	];

	var applicationTable = [
	];

	var sectionDividerTable = {
		chapter: "/TEI/text/body/div/p",
		section: "/p/p"
	}

	var tagTable = [
		{ type: "person", tag: "//name[@type='person' and @n='fullName']", 
		    linkdata: [ { from: "/name/@key", to: "cbdbid"} ]},
		{ type: "person", subtype: "othername", tag: "//name[@type='person' and @n='partialName']",
		    linkdata: [ { from: "/name/@key", to: "cbdbid"} ]},
		 { type: "location", tag: "//placeName"},
		 { type: "person", subtype: "officialTitle", tag: "//roleName[@n='officialTitle']"},
		 { type: "datetime",  tag: "//name [@type='timePeriod' and @n='timePeriod']"},
	];

	var tagIgnore = [
	];

	function isString(val) {
	   return typeof val === 'string' || ((!!val && typeof val === 'object') && Object.prototype.toString.call(val) === '[object String]');
	}

	var appendAllChildren = function( nodeString, nodeTo ){
		var parser = new DOMParser();
		var xmlTemp = parser.parseFromString("<append>" + nodeString + "</append>", "text/xml");
		var nodeFrom = xmlTemp.getElementsByTagName("append")[0];
		while( nodeFrom.hasChildNodes() ){
			nodeTo.appendChild(nodeFrom.removeChild(nodeFrom.firstChild));
		}
	}

	var XMLTableToJSON  = function( table ){
		return function(context){
			var jsonData= {};
			var parser = new DOMParser();
			var xmlDoc = parser.parseFromString(context.replace("xmlns", "xxx").replace("xmlns:xi", "xxxx"), "text/xml");

			for( var i = 0 ; i < table.length ; i++ ){
				if( table[i].key ){
					jsonData[table[i].key] = table[i].value;
					continue;
				}
				var nodes = xmlDoc.evaluate(table[i].from, xmlDoc, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
				jsonData[table[i].to] = [];
				var node;
				while( node = nodes.iterateNext() ){
					if( node.nodeType === 1 ){
						jsonData[table[i].to] = node.textContent.escape();
					}
					else if( node.nodeType === 2 ){
						jsonData[table[i].to] = node.value;
					}
					else if( node.nodeType === 3 ){
						jsonData[table[i].to] = node.nodeValue;
					}
				}

				if( jsonData[table[i].to].length === 1 ){
					jsonData[table[i].to] = jsonData[table[i].to][0];
				}

				if( jsonData[table[i].to].length === 0 ){
					delete jsonData[table[i].to];
				}
			}

			return jsonData;
		};
	}

	var createXMLDocumentFromNode = function( node ){
		return (new DOMParser()).parseFromString( (new XMLSerializer()).serializeToString(node), "text/xml");
	}

	var recursiveXML = function( node ){
		var content = {};
		var last = content;
		var now = content;

		for( var i = 0 ; i < tagTable.length ; i++ ){
			var tags = node.evaluate( tagTable[i].tag, node, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null );
			var tag;
			while( tag = tags.iterateNext() ){
				now.type = tagTable[i].type;
				if( tagTable[i].subtype ){
					now.subtype = tagTable[i].subtype;
				}
				if( tagTable[i].userdata ){
					now.userdata = (new XMLTableToJSON(tagTable[i].userdata))((new XMLSerializer()).serializeToString(tag) );
					if( Object.keys(now.userdata).length === 0 ){
						now.userdata = undefined;
						delete now.userdata;
					}
				}
				if( tagTable[i].linkdata ){
					now.linkdata = (new XMLTableToJSON(tagTable[i].linkdata))((new XMLSerializer()).serializeToString(tag) );
					if( Object.keys(now.linkdata).length === 0 ){
						now.linkdata = undefined;
						delete now.linkdata;
					}
				}

				last = now;
				now.content = {};
				now = now.content;
			}
		}

		last.content = node.firstChild.textContent.escape();

		return content;
	}

	var generateTag = function( object ){
		if( isString(object) ) return object;

		var tag = '<span class="' ;
		var tagName, moreThanOneIdData, moreThanOneIdAttribute;
		if( object.type === "person" ){
			if( object.subtype === "othername" ){
				tagName = "partialName";
				moreThanOneIdData = "linkdata";
				moreThanOneIdAttribute = "cbdbid";
			}
			else if( object.subtype === "officialTitle" ){
				tagName = "officialTitle";
				moreThanOneIdData = "userdata";
				moreThanOneIdAttribute = "note";
			}
			else {
				tagName = "fullName";
				moreThanOneIdData = "linkdata";
				moreThanOneIdAttribute = "cbdbid";
			}
		}
		else if(object.type === "location"){
			tagName = "placeName";
			moreThanOneIdData = "userdata";
			moreThanOneIdAttribute = "note";
		}
		else if(object.type === "datetime"){
			tagName = "timePeriod";
			moreThanOneIdData = "userdata";
			moreThanOneIdAttribute = "note";
		}
		else {
			return object.textContent;
		}

		tag += tagName + " markup unsolved";
		if( object[moreThanOneIdData] && object[moreThanOneIdData] [moreThanOneIdAttribute] && object[moreThanOneIdData] [moreThanOneIdAttribute] .split("|").length > 1 ){
			tag += " moreThanOneId";
		}
		tag += '" type="' + tagName + '"';
		if( object.linkdata ){
			for( var key in object.linkdata ){
				if( key === "id" ){
					continue;
				}
				tag += " " + key + '="' + object.linkdata[key] + '"';
			}
		}

		if( object.userdata ){
			for( var key in object.userdata ){
				if( key === "note" ){
					tag += " " + tagName.toLowerCase + '_id="' + object.userdata[key] + '"'
				}
				else if( key === "id" ){
					continue;
				}
				else {
					tag += " " + key + '="' + object.userdata[key] + '"';
				}
			}
		} 

		tag += ">"

		if( isString(object.content) ){
			tag += object.content;
		}
		else {
			tag += generateTag(object.content);
		}

		tag += "</span>"

		return tag;
	}

	return {
		metadataTransformer: XMLTableToJSON(metadataTable),
		sectionDivider: function( context ){
			var parser = new DOMParser();
			var xmlDoc = parser.parseFromString(context.replace("xmlns", "xxx").replace("xmlns:xi", "xxxx"), "text/xml");

			var chapters = [];
			if( sectionDividerTable.chapter ){
				var nodes = xmlDoc.evaluate(sectionDividerTable.chapter, xmlDoc, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
				var node;
				while( node = nodes.iterateNext() ){
					chapters.push( createXMLDocumentFromNode(node) );
				}
			}
			else{
				chapters.push(xmlDoc);
			}

			var sections = [];
			for( var i = 0 ; i < chapters.length ; i++ ){
				sections.push([]);
				var nodes = chapters[i].evaluate(sectionDividerTable.section, chapters[i], null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
				var node;
				while( node = nodes.iterateNext() ){
					sections[i].push((new XMLSerializer()).serializeToString(node));
				}
			}

			return sections;
		},
		tagTransformer: function( context ){
			var content = [];
			var parser = new DOMParser();
			var xmlDoc = parser.parseFromString(context, "text/xml");

			var nodes = xmlDoc.firstChild.childNodes;
			for( var i = 0 ; i < nodes.length ; i++ ){
				if( nodes[i].nodeType === 3 ){
					content.push( nodes[i].nodeValue.escape() );
				}
				else if( nodes[i].nodeType === 1 ){
					var node = createXMLDocumentFromNode(nodes[i]);
					var ignore = false;
					for( var j = 0 ; j < tagIgnore.length ; j++ ){
						if( node.evaluate(tagIgnore[j], node, null, XPathResult.ANY_TYPE, null).iterateNext() ){
							ignore = true;
							break;
						}
					}
					if( !ignore ) content.push( recursiveXML(node) );
				}
			}

			return content;
		},

		applicationSetting: XMLTableToJSON(applicationTable),
		mergeToContext: function( input ){
			var metadata = input.metadata;
			var sections = input.sections;
			var application = input.application;
			
			var parser = new DOMParser();
			var xmlDoc = parser.parseFromString( "<div class='doc'><pre></pre></div>" ,"text/xml");

			// metadata
			var rootNode = xmlDoc.evaluate("/div[@class='doc']", xmlDoc, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null).iterateNext();
			
			var filename = xmlDoc.createAttribute("filename");
			filename.value = metadata.filename;
			rootNode.setAttributeNode(filename);
			
			// application
			for( var i = 0 ; i < application.length ;i++ ){
				if( application[i].name === "MARKUS" ){
					var tag = xmlDoc.createAttribute("tag");
					tag.value = application[i].tag;
					rootNode.setAttributeNode(tag);
				}
			}

			// sections
			var sectionNumber = 0;
			for( var i = 0 ; i < sections.length ; i++ ){
				for( var j = 0 ; j < sections[i].length ; j++, sectionNumber++ ){
					var section = '<span class="passage" type="passage" id="passage' + sectionNumber + '"><span class="commentContainer" value="[]"><span class="glyphicon glyphicon-comment" type="commentIcon" style="display:none" aria-hidden="true" data-markus-passageid="passage' + sectionNumber + '"></span></span>';
					for( var k = 0 ; k < sections[i][j].length ; k++ ){
						section += generateTag( sections[i][j][k] );
					}
					section += "</span>\n\n"; 
					appendAllChildren( section, xmlDoc.getElementsByTagName("div")[0].getElementsByTagName("pre")[0] );
				}
			}


			return (new XMLSerializer()).serializeToString(xmlDoc) ;
		}
	};
})();