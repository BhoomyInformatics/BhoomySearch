/**
 * Advanced Boolean Search Parser for Elasticsearch
 * Supports:
 * - AND, OR, NOT operators
 * - Parentheses for grouping
 * - Quoted phrases: "machine learning"
 * - Field-specific search: title:apple, body:"banana split", author:john
 * - Special operators: site:example.com, intitle:keyword, filetype:pdf
 * - Range queries: date:>=2020-01-01, date:<=2021-12-31, score:>5.0
 */

class BooleanQueryParser {
    constructor() {
        this.fieldMappings = {
            'site': 'site_data_link',
            'domain': 'site_data_link', 
            'intitle': 'site_data_title',
            'title': 'site_data_title',
            'body': 'site_data_article',
            'content': 'site_data_article',
            'description': 'site_data_description',
            'author': 'site_data_author',
            'filetype': 'site_data_link',
            'url': 'site_data_link',
            'date': 'site_data_last_update',
            'created': 'site_data_date',
            'updated': 'site_data_last_update',
            'score': '_score',
            'visits': 'site_data_visit',
            'category': 'site_category',
            'language': 'site_language',
            'country': 'site_country'
        };

        this.rangeOperators = ['>=', '<=', '>', '<', '='];
        this.specialOperators = ['site:', 'intitle:', 'filetype:'];
    }

    /**
     * Parse a boolean search string into Elasticsearch DSL
     * @param {string} queryString - The search query string
     * @returns {Object} Elasticsearch query object
     */
    parse(queryString) {
        if (!queryString || typeof queryString !== 'string') {
            return { query: { match_all: {} } };
        }

        try {
            // Normalize the query string
            const normalizedQuery = this.normalizeQuery(queryString);
            
            // Tokenize the query
            const tokens = this.tokenize(normalizedQuery);
            
            // Parse tokens into Elasticsearch DSL
            const parsedQuery = this.parseTokens(tokens);
            
            return { query: parsedQuery };
        } catch (error) {
            console.error('Boolean query parsing error:', error);
            // Fallback to simple match query
            return { 
                query: { 
                    multi_match: { 
                        query: queryString, 
                        fields: ['site_data_title^3', 'site_data_description^2', 'site_data_article^1'] 
                    } 
                } 
            };
        }
    }

    /**
     * Normalize the query string
     * @param {string} queryString - Raw query string
     * @returns {string} Normalized query string
     */
    normalizeQuery(queryString) {
        return queryString
            .replace(/\s+/g, ' ')  // Normalize whitespace
            .trim()
            .replace(/\band\b/gi, 'AND')
            .replace(/\bor\b/gi, 'OR')
            .replace(/\bnot\b/gi, 'NOT');
    }

    /**
     * Tokenize the query string
     * @param {string} queryString - Normalized query string
     * @returns {Array} Array of tokens
     */
    tokenize(queryString) {
        // Match quoted phrases, parentheses, operators, and field:value patterns
        const tokenPattern = /"[^"]+"|\(|\)|\bAND\b|\bOR\b|\bNOT\b|[^\s()]+/g;
        return queryString.match(tokenPattern) || [];
    }

    /**
     * Parse tokens into Elasticsearch DSL
     * @param {Array} tokens - Array of tokens
     * @returns {Object} Elasticsearch query object
     */
    parseTokens(tokens) {
        const current = { must: [], should: [], must_not: [] };
        let mode = 'must'; // default operator
        let i = 0;

        while (i < tokens.length) {
            const token = tokens[i];

            if (token === '(') {
                // Handle parentheses - recursive parsing
                const { nestedQuery, nextIndex } = this.parseParentheses(tokens, i + 1);
                i = nextIndex;
                
                if (mode === 'must') current.must.push(nestedQuery);
                else if (mode === 'should') current.should.push(nestedQuery);
                else if (mode === 'must_not') current.must_not.push(nestedQuery);
            } else if (token === ')') {
                break;
            } else if (token === 'AND') {
                mode = 'must';
                i++;
            } else if (token === 'OR') {
                mode = 'should';
                i++;
            } else if (token === 'NOT') {
                mode = 'must_not';
                i++;
            } else {
                // Handle search terms and field queries
                const queryClause = this.parseTerm(token);
                
                if (mode === 'must') current.must.push(queryClause);
                else if (mode === 'should') current.should.push(queryClause);
                else if (mode === 'must_not') current.must_not.push(queryClause);
                
                i++;
            }
        }

        return this.buildBoolQuery(current);
    }

    /**
     * Parse parentheses group
     * @param {Array} tokens - Array of tokens
     * @param {number} startIndex - Starting index
     * @returns {Object} Parsed query and next index
     */
    parseParentheses(tokens, startIndex) {
        const groupTokens = [];
        let depth = 1;
        let i = startIndex;

        while (i < tokens.length && depth > 0) {
            if (tokens[i] === '(') depth++;
            else if (tokens[i] === ')') depth--;
            
            if (depth > 0) {
                groupTokens.push(tokens[i]);
            }
            i++;
        }

        return {
            nestedQuery: this.parseTokens(groupTokens),
            nextIndex: i
        };
    }

    /**
     * Parse individual term into query clause
     * @param {string} term - Search term
     * @returns {Object} Elasticsearch query clause
     */
    parseTerm(term) {
        // Handle quoted phrases
        if (term.startsWith('"') && term.endsWith('"')) {
            const phrase = term.slice(1, -1);
            return {
                multi_match: {
                    query: phrase,
                    type: 'phrase',
                    fields: ['site_data_title^3', 'site_data_description^2', 'site_data_article^1']
                }
            };
        }

        // Handle field:value syntax
        if (term.includes(':')) {
            return this.parseFieldQuery(term);
        }

        // Handle special operators
        for (const operator of this.specialOperators) {
            if (term.startsWith(operator)) {
                return this.parseSpecialOperator(term, operator);
            }
        }

        // Default term search
        return {
            multi_match: {
                query: term,
                fields: ['site_data_title^3', 'site_data_description^2', 'site_data_article^1'],
                type: 'best_fields',
                fuzziness: 'AUTO'
            }
        };
    }

    /**
     * Parse field:value query
     * @param {string} term - Field:value term
     * @returns {Object} Elasticsearch query clause
     */
    parseFieldQuery(term) {
        const colonIndex = term.indexOf(':');
        const field = term.substring(0, colonIndex);
        const value = term.substring(colonIndex + 1);

        // Check for range operators
        const rangeQuery = this.parseRangeQuery(field, value);
        if (rangeQuery) {
            return rangeQuery;
        }

        // Map field to Elasticsearch field
        const esField = this.fieldMappings[field.toLowerCase()] || field;

        // Handle quoted values
        if (value.startsWith('"') && value.endsWith('"')) {
            const phraseValue = value.slice(1, -1);
            return {
                match_phrase: {
                    [esField]: phraseValue
                }
            };
        }

        // Regular field match
        return {
            match: {
                [esField]: {
                    query: value,
                    fuzziness: 'AUTO'
                }
            }
        };
    }

    /**
     * Parse range queries (e.g., date:>=2020-01-01, score:>5.0)
     * @param {string} field - Field name
     * @param {string} value - Value with potential range operator
     * @returns {Object|null} Range query or null
     */
    parseRangeQuery(field, value) {
        for (const operator of this.rangeOperators) {
            if (value.includes(operator)) {
                const parts = value.split(operator);
                if (parts.length === 2) {
                    const rangeValue = parts[1].trim();
                    const esField = this.fieldMappings[field.toLowerCase()] || field;
                    
                    const rangeClause = {};
                    
                    switch (operator) {
                        case '>=':
                            rangeClause.gte = this.parseRangeValue(rangeValue, field);
                            break;
                        case '<=':
                            rangeClause.lte = this.parseRangeValue(rangeValue, field);
                            break;
                        case '>':
                            rangeClause.gt = this.parseRangeValue(rangeValue, field);
                            break;
                        case '<':
                            rangeClause.lt = this.parseRangeValue(rangeValue, field);
                            break;
                        case '=':
                            rangeClause.gte = this.parseRangeValue(rangeValue, field);
                            rangeClause.lte = this.parseRangeValue(rangeValue, field);
                            break;
                    }

                    return {
                        range: {
                            [esField]: rangeClause
                        }
                    };
                }
            }
        }
        return null;
    }

    /**
     * Parse range value based on field type
     * @param {string} value - Raw value
     * @param {string} field - Field name
     * @returns {string|number} Parsed value
     */
    parseRangeValue(value, field) {
        // Handle date fields
        if (['date', 'created', 'updated'].includes(field.toLowerCase())) {
            // Support relative dates like "now-30d", "now-1y"
            if (value.startsWith('now')) {
                return value;
            }
            // Support absolute dates
            return new Date(value).toISOString();
        }
        
        // Handle numeric fields
        if (['score', 'visits'].includes(field.toLowerCase())) {
            return parseFloat(value);
        }
        
        // Default to string
        return value;
    }

    /**
     * Parse special operators (site:, intitle:, filetype:)
     * @param {string} term - Term with special operator
     * @param {string} operator - Special operator
     * @returns {Object} Elasticsearch query clause
     */
    parseSpecialOperator(term, operator) {
        const value = term.substring(operator.length);

        switch (operator) {
            case 'site:':
                return {
                    wildcard: {
                        site_data_link: `*${value}*`
                    }
                };
            case 'intitle:':
                return {
                    match: {
                        site_data_title: {
                            query: value,
                            fuzziness: 'AUTO'
                        }
                    }
                };
            case 'filetype:':
                return {
                    wildcard: {
                        site_data_link: `*.${value}`
                    }
                };
            default:
                return {
                    multi_match: {
                        query: value,
                        fields: ['site_data_title^3', 'site_data_description^2', 'site_data_article^1']
                    }
                };
        }
    }

    /**
     * Build final bool query
     * @param {Object} current - Current query state
     * @returns {Object} Elasticsearch bool query
     */
    buildBoolQuery(current) {
        const boolQuery = { bool: {} };

        if (current.must.length > 0) {
            boolQuery.bool.must = current.must;
        }

        if (current.should.length > 0) {
            boolQuery.bool.should = current.should;
            boolQuery.bool.minimum_should_match = 1;
        }

        if (current.must_not.length > 0) {
            boolQuery.bool.must_not = current.must_not;
        }

        // If no clauses, return match_all
        if (current.must.length === 0 && current.should.length === 0 && current.must_not.length === 0) {
            return { match_all: {} };
        }

        return boolQuery;
    }

    /**
     * Get search syntax help
     * @returns {Object} Help information
     */
    getSyntaxHelp() {
        return {
            operators: {
                'AND': 'All terms must be present (default)',
                'OR': 'At least one term must be present',
                'NOT': 'Exclude terms from results'
            },
            grouping: {
                '()': 'Group terms for complex logic',
                'Example': '(apple OR banana) AND mango'
            },
            phrases: {
                '""': 'Search for exact phrases',
                'Example': '"machine learning"'
            },
            fields: {
                'title:': 'Search in title field',
                'body:': 'Search in content/body field',
                'author:': 'Search by author',
                'site:': 'Search within specific domain',
                'intitle:': 'Search only in title',
                'filetype:': 'Search specific file types'
            },
            ranges: {
                'date:>=2020-01-01': 'Date greater than or equal',
                'date:<=2021-12-31': 'Date less than or equal',
                'score:>5.0': 'Numeric range queries'
            },
            examples: [
                'apple AND banana',
                '(apple OR orange) AND NOT politics',
                'title:"machine learning" AND author:smith',
                'site:example.com AND filetype:pdf',
                'date:>=2020-01-01 AND date:<=2021-12-31',
                'intitle:javascript AND body:"react hooks"'
            ]
        };
    }
}

module.exports = BooleanQueryParser;
